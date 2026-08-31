package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.hr.dto.ManualMarkRequest;
import com.saas.school.modules.hr.dto.MarkSelfAttendanceRequest;
import com.saas.school.modules.hr.dto.MarkSelfResponse;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Reads + writes on {@link EmployeeAttendance}. Handles all three
 * write paths (self-mark via location, admin manual entry, biometric
 * rollup — the third comes in Phase 1b) and the read paths for both
 * the employee's "My Attendance" and the HR daily / monthly views.
 *
 * <p>Every write path funnels through {@link #upsertPunch} so the
 * "IN sets inTime + status, second call becomes OUT" state machine
 * lives in exactly one place. The unique index on
 * {@code (employeeId, date)} is our safety net if two requests race.</p>
 */
@Service
public class EmployeeAttendanceService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeAttendanceService.class);
    /** All time thresholds (late / half-day / auto-absent) are quoted
     *  in the school's local time — Indian schools set them in
     *  Asia/Kolkata regardless of server timezone. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired private EmployeeAttendanceRepository repo;
    @Autowired private EmployeeAttendanceSettingsService settingsService;
    @Autowired private TeacherRepository teacherRepo;

    // ── Location-based self-mark ─────────────────────────────

    /**
     * Employee taps the "Mark Attendance" button on their phone.
     * Validates the tenant has location-based marking on, that the
     * caller has a linked Teacher row (so we know the employeeId),
     * geofences the coordinates, then upserts a punch.
     *
     * @param userId  the authenticated caller — resolved to an
     *                employee via the Teacher.userId back-reference
     * @throws BusinessException when the tenant hasn't enabled
     *   location marking, the user isn't linked to any employee,
     *   the coordinates are missing, the location is outside the
     *   allowed radius, the accuracy is worse than the tenant
     *   threshold, or a mock provider is detected + rejection is on
     */
    public MarkSelfResponse markSelf(String userId, MarkSelfAttendanceRequest req) {
        EmployeeAttendanceSettings settings = settingsService.getOrCreate();
        if (!settings.isLocationBasedEnabled()) {
            throw new BusinessException("Location-based attendance is not enabled for this school.");
        }
        if (settings.getCampusLatitude() == null || settings.getCampusLongitude() == null) {
            throw new BusinessException(
                "Campus location isn't set yet — ask HR to configure it on the Attendance Settings page.");
        }
        if (req == null || req.getLatitude() == null || req.getLongitude() == null) {
            throw new BusinessException("Location is required to mark attendance. Enable GPS and retry.");
        }
        Teacher employee = teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new BusinessException(
                    "Your account isn't linked to an employee record. Ask HR to link it."));

        // Guardrails — accuracy check first, then mock, then geofence.
        // Cheaper checks run before the haversine so a bogus payload
        // fails fast.
        if (req.getAccuracyMeters() != null
                && req.getAccuracyMeters() > settings.getMaxAccuracyMeters()) {
            throw new BusinessException(
                "GPS accuracy is too poor (" + req.getAccuracyMeters().intValue()
                + "m). Move to an open area and try again.");
        }
        if (req.isMocked() && settings.isRejectMockLocations()) {
            throw new BusinessException(
                "Fake GPS location detected. Turn off Developer options and retry.");
        }
        double distanceMeters = GeofenceService.haversineMeters(
                req.getLatitude(), req.getLongitude(),
                settings.getCampusLatitude(), settings.getCampusLongitude());
        if (distanceMeters > settings.getAllowedRadiusMeters()) {
            throw new BusinessException(
                "You're " + (int) distanceMeters + "m from campus (limit "
                + settings.getAllowedRadiusMeters() + "m). Move closer and try again.");
        }

        LocalDate today = LocalDate.now(ZONE);
        return upsertPunch(employee.getTeacherId(), today, Instant.now(),
                settings, "LOCATION", userId,
                req.getLatitude(), req.getLongitude(), req.getAccuracyMeters(),
                distanceMeters, req.isMocked());
    }

    // ── Manual entry (HR only — controller gates it) ─────────

    /**
     * HR admin fills in an attendance row on behalf of an employee.
     * Overwrites any existing row for that date — the "manual entry
     * always wins" rule matches user expectation on the HR daily
     * view (edit-in-place feels natural, ask-for-confirmation would
     * feel like the UI is fighting the admin).
     */
    public EmployeeAttendance markManual(ManualMarkRequest req, String userId) {
        if (req == null) throw new BusinessException("Manual mark payload is required.");
        if (req.getEmployeeId() == null || req.getEmployeeId().isBlank()) {
            throw new BusinessException("employeeId is required.");
        }
        if (req.getDate() == null) throw new BusinessException("date is required.");
        if (req.getStatus() == null || req.getStatus().isBlank()) {
            throw new BusinessException("status is required.");
        }
        Teacher employee = teacherRepo.findById(req.getEmployeeId())
                .orElseThrow(() -> new BusinessException("Employee not found."));

        EmployeeAttendance existing = repo.findByEmployeeIdAndDate(
                employee.getTeacherId(), req.getDate()).orElse(null);
        EmployeeAttendance row = existing != null ? existing : new EmployeeAttendance();
        if (existing == null) {
            row.setAttendanceId(UUID.randomUUID().toString());
            row.setEmployeeId(employee.getTeacherId());
            row.setDate(req.getDate());
        }
        row.setStatus(req.getStatus().toUpperCase());
        row.setInTime(req.getInTime());
        row.setOutTime(req.getOutTime());
        row.setSource("MANUAL");
        row.setMarkedByUserId(userId);
        row.setRemarks(req.getRemarks());
        // Manual entry is authoritative — we don't re-run late/mock
        // computation, HR picked the status themselves.
        row.setLate("LATE".equalsIgnoreCase(req.getStatus()));
        return repo.save(row);
    }

    // ── Reads ────────────────────────────────────────────────

    /** HR "Daily view — everyone today". */
    public List<EmployeeAttendance> getDaily(LocalDate date) {
        if (date == null) date = LocalDate.now(ZONE);
        return repo.findByDate(date);
    }

    /** Employee "My Attendance — this month" AND HR per-employee
     *  monthly report. The caller controls the range. */
    public List<EmployeeAttendance> getMonthly(String employeeId, LocalDate from, LocalDate to) {
        if (employeeId == null || employeeId.isBlank()) return List.of();
        if (from == null || to == null) {
            LocalDate today = LocalDate.now(ZONE);
            from = today.withDayOfMonth(1);
            to = today.withDayOfMonth(today.lengthOfMonth());
        }
        return repo.findByEmployeeIdAndDateBetween(employeeId, from, to);
    }

    /** Look up the caller's linked employee record; used by
     *  {@code GET /hr/attendance/my} to fetch monthly rows without
     *  requiring the frontend to know the employeeId. */
    public String resolveEmployeeIdForUser(String userId) {
        return teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
                .map(Teacher::getTeacherId).orElse(null);
    }

    // ── Internals ────────────────────────────────────────────

    /**
     * Central write path — the two states are "no row yet" (first
     * call of the day → IN) and "row already IN'd" (second call →
     * OUT). Sits inside a {@code findByEmployeeIdAndDate → save}
     * cycle. Under a concurrent race the unique index would fail one
     * of the two saves; the caller catches {@code DuplicateKeyException}
     * upstream if we ever hit that path (in practice self-mark is
     * user-triggered clicks minutes apart, so the race is theoretical).
     */
    private MarkSelfResponse upsertPunch(String employeeId, LocalDate date, Instant when,
                                          EmployeeAttendanceSettings settings, String source,
                                          String markedByUserId,
                                          Double lat, Double lng, Double accuracy,
                                          Double distanceMeters, boolean mocked) {
        EmployeeAttendance existing = repo.findByEmployeeIdAndDate(employeeId, date).orElse(null);

        // First punch of the day — write IN + compute status.
        if (existing == null) {
            EmployeeAttendance row = new EmployeeAttendance();
            row.setAttendanceId(UUID.randomUUID().toString());
            row.setEmployeeId(employeeId);
            row.setDate(date);
            row.setInTime(when);
            row.setSource(source);
            row.setMarkedByUserId(markedByUserId);
            row.setMarkLatitude(lat);
            row.setMarkLongitude(lng);
            row.setMarkAccuracyMeters(accuracy);
            row.setDistanceFromCampusMeters(distanceMeters);
            row.setMockLocation(mocked);

            boolean isLate = isAfterOrEqual(when, settings.getLateThreshold());
            boolean isHalfDay = isAfterOrEqual(when, settings.getHalfDayThreshold());
            row.setStatus(isHalfDay ? "HALF_DAY" : "PRESENT");
            row.setLate(isLate);

            repo.save(row);
            log.info("Employee self-mark IN: employee={} date={} status={} late={} distance={}m",
                    employeeId, date, row.getStatus(), isLate, distanceMeters == null ? -1 : distanceMeters.intValue());
            return MarkSelfResponse.from(row, "IN");
        }

        // Row exists — deduplicate OR promote to OUT depending on
        // tenant config.
        if (settings.getExpectedPunchesPerDay() < 2) {
            // Single-punch tenant — treat second call as an idempotent
            // "already marked". Return the existing row unchanged.
            log.info("Employee re-mark ignored (single-punch mode): employee={} date={}",
                    employeeId, date);
            return MarkSelfResponse.from(existing, "IN");
        }
        // Two-punch tenant — set OUT if not already set; otherwise
        // silent no-op (third+ tap of the day).
        if (existing.getOutTime() == null) {
            existing.setOutTime(when);
            // Only overwrite location on the OUT punch; keep the IN
            // punch's location intact for the audit trail.
            existing.setMarkedByUserId(markedByUserId);
            repo.save(existing);
            log.info("Employee self-mark OUT: employee={} date={}", employeeId, date);
            return MarkSelfResponse.from(existing, "OUT");
        }
        log.info("Employee re-mark ignored (both punches already set): employee={} date={}",
                employeeId, date);
        return MarkSelfResponse.from(existing, existing.getOutTime() != null ? "OUT" : "IN");
    }

    /**
     * Compares a UTC instant against a tenant-configured "HH:mm"
     * threshold in the tenant timezone. Returns true when the instant
     * is at or after the threshold on the same calendar day.
     */
    private static boolean isAfterOrEqual(Instant when, String hhmm) {
        if (when == null || hhmm == null || hhmm.isBlank()) return false;
        try {
            ZonedDateTime local = when.atZone(ZONE);
            LocalTime threshold = LocalTime.parse(hhmm);
            return !local.toLocalTime().isBefore(threshold);
        } catch (Exception e) {
            log.warn("Bad time threshold '{}' — treating as not late", hhmm);
            return false;
        }
    }
}
