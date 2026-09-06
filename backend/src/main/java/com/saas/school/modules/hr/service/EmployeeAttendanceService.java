package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.hr.dto.HrAttendanceReportResponse;
import com.saas.school.modules.hr.dto.HrDailyAttendanceDto;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
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

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    /** Optional — the report endpoint fetches declared holidays from
     *  here to exclude them from the working-day count. Marked
     *  {@code required = false} so the service still bootstraps in
     *  test slices where the Event module isn't wired. */
    @Autowired(required = false) private SchoolEventRepository schoolEventRepo;

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

    // ── Biometric-terminal punch (called by ADMS controller) ─

    /**
     * Route an eSSL scan into an employee's attendance row. Called
     * from {@code AdmsPushController.processLine} after the
     * (serial, terminalUserId) has resolved to an employee. Silently
     * no-ops when biometric marking is disabled for the tenant so a
     * misconfigured device can't sneak punches through — but does
     * NOT throw, so the terminal keeps its upload queue draining.
     *
     * <p>Direction from the terminal is advisory: some firmwares
     * always emit "0" (IN) regardless of the physical IN/OUT press,
     * so we still fall through to the IN → OUT state machine in
     * {@link #upsertPunch} rather than trusting the byte blindly. If
     * an OUT is quoted and an IN row exists, we upgrade to OUT
     * directly.</p>
     */
    public void recordBiometricPunch(String employeeId, String terminalSerial,
                                      String terminalUserId, String direction,
                                      Instant scannedAt) {
        if (employeeId == null || scannedAt == null) return;
        EmployeeAttendanceSettings settings = settingsService.getOrCreate();
        if (!settings.isBiometricBasedEnabled()) {
            log.debug("Biometric punch dropped — tenant has biometric marking off; employee={}", employeeId);
            return;
        }
        // Resolve the tenant date from the punch instant (not
        // wall-clock now) — a late-night punch after midnight IST
        // shouldn't be attributed to the previous day.
        LocalDate date = scannedAt.atZone(ZONE).toLocalDate();
        // Manual + location marks both stamp source; keep that
        // contract by tagging BIOMETRIC. Terminal user id + serial
        // are kept on the row via markedByUserId for the audit trail
        // (repurposed since biometric has no HR admin actor).
        String actor = "adms:" + terminalSerial + "/" + terminalUserId;

        // If the terminal claims OUT and there's already an IN, jump
        // straight to promoting OUT rather than running the full
        // isLate/isHalfDay computation on the OUT time.
        if ("OUT".equalsIgnoreCase(direction)) {
            EmployeeAttendance existing = repo.findByEmployeeIdAndDate(employeeId, date).orElse(null);
            if (existing != null && existing.getOutTime() == null) {
                existing.setOutTime(scannedAt);
                existing.setMarkedByUserId(actor);
                // Recompute HALF_DAY vs PRESENT now that we can
                // measure duration — same rule as the location path.
                applyHalfDayRule(existing, settings);
                repo.save(existing);
                log.info("Biometric OUT recorded: employee={} date={} serial={} status={}",
                    employeeId, date, terminalSerial, existing.getStatus());
                return;
            }
            // No IN row yet but terminal quoted OUT — treat as a
            // late-first-punch (the person walked in without
            // scanning, then scanned OUT going home). Fall through
            // to upsertPunch which will create an IN row.
        }
        upsertPunch(employeeId, date, scannedAt, settings, "BIOMETRIC", actor,
            null, null, null, null, false);
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

    /**
     * Same as {@link #getDaily(LocalDate)} but each row carries the
     * employee's display name + designation, batch-fetched from the
     * Teacher collection. Frontend consumes this shape directly so
     * it doesn't need to hit {@code GET /api/v1/employees} — that
     * endpoint is admin-gated and 403s for HR users, which is why
     * the earlier client-side lookup showed raw UUIDs.
     */
    public List<HrDailyAttendanceDto> getDailyEnriched(LocalDate date) {
        List<EmployeeAttendance> rows = getDaily(date);
        if (rows.isEmpty()) return List.of();

        List<String> employeeIds = rows.stream()
            .map(EmployeeAttendance::getEmployeeId)
            .filter(id -> id != null && !id.isBlank())
            .distinct()
            .toList();
        Map<String, Teacher> byId = teacherRepo.findAllById(employeeIds).stream()
            .filter(t -> t.getDeletedAt() == null)
            .collect(Collectors.toMap(Teacher::getTeacherId, t -> t, (a, b) -> a));

        List<HrDailyAttendanceDto> out = new ArrayList<>(rows.size());
        for (EmployeeAttendance r : rows) {
            HrDailyAttendanceDto dto = new HrDailyAttendanceDto();
            dto.setAttendanceId(r.getAttendanceId());
            dto.setEmployeeId(r.getEmployeeId());
            Teacher t = byId.get(r.getEmployeeId());
            dto.setEmployeeName(t != null ? displayName(t) : "(deleted employee)");
            dto.setDesignation(t != null ? t.getEmployeeRole() : null);
            dto.setDate(r.getDate());
            dto.setStatus(r.getStatus());
            dto.setLate(r.isLate());
            dto.setInTime(r.getInTime());
            dto.setOutTime(r.getOutTime());
            dto.setSource(r.getSource());
            dto.setDistanceFromCampusMeters(r.getDistanceFromCampusMeters());
            dto.setMarkAccuracyMeters(r.getMarkAccuracyMeters());
            dto.setRemarks(r.getRemarks());
            out.add(dto);
        }
        return out;
    }

    /**
     * Resolve declared holidays overlapping the given range, expanded
     * to one entry per calendar day. Silent-fail — a broken event
     * query returns an empty list so callers still get a valid
     * response object. Used by both the HR Attendance Report and the
     * employee "My Attendance" calendar (Sundays are the tenant's
     * only automatic off-day; declared holidays must come from here).
     */
    public HrAttendanceReportResponse getHolidaysInRange(LocalDate from, LocalDate to) {
        List<LocalDate> dates = new ArrayList<>();
        List<String> names = new ArrayList<>();
        if (schoolEventRepo == null || from == null || to == null) {
            return new HrAttendanceReportResponse(List.of(), dates, names);
        }
        LocalDate rangeFrom = from.isAfter(to) ? to : from;
        LocalDate rangeTo   = from.isAfter(to) ? from : to;
        try {
            List<SchoolEvent> events = schoolEventRepo.findOverlappingHolidays(rangeFrom, rangeTo);
            for (SchoolEvent e : events) {
                LocalDate start = e.getStartDate();
                LocalDate end = e.getEndDate() != null ? e.getEndDate() : start;
                if (start == null) continue;
                LocalDate clipStart = start.isBefore(rangeFrom) ? rangeFrom : start;
                LocalDate clipEnd = end.isAfter(rangeTo) ? rangeTo : end;
                for (LocalDate d = clipStart; !d.isAfter(clipEnd); d = d.plusDays(1)) {
                    dates.add(d);
                    names.add(e.getTitle() != null ? e.getTitle() : "");
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to load holidays for range {}..{}: {}", rangeFrom, rangeTo, ex.getMessage());
        }
        return new HrAttendanceReportResponse(List.of(), dates, names);
    }

    private static String displayName(Teacher t) {
        String first = t.getFirstName() == null ? "" : t.getFirstName().trim();
        String last  = t.getLastName() == null ? "" : t.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (t.getEmployeeId() != null) return "Emp " + t.getEmployeeId();
        return t.getTeacherId();
    }

    /**
     * HR Attendance Report — everyone's rows across a date range,
     * enriched with employee name + designation. Powers the
     * "Attendance Report" page under HR → Attendance.
     *
     * <p>Bounds inclusive both sides. Same enrichment logic as
     * {@link #getDailyEnriched(LocalDate)} but over a longer window,
     * so the frontend can render employee-wise summaries + day-by-day
     * grids without a second call to lookup names.</p>
     */
    public HrAttendanceReportResponse getReportEnriched(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            LocalDate today = LocalDate.now(ZONE);
            from = today.withDayOfMonth(1);
            to = today;
        }
        if (from.isAfter(to)) {
            LocalDate tmp = from; from = to; to = tmp;
        }
        // Holidays first — they're a small list and needed even when
        // there are zero attendance rows (so the empty state's KPI
        // strip still shows an accurate "working days" count).
        HrAttendanceReportResponse holidays = getHolidaysInRange(from, to);
        List<LocalDate> holidayDates = holidays.getHolidayDates();
        List<String> holidayNames = holidays.getHolidayNames();

        List<EmployeeAttendance> rows = repo.findByDateBetween(from, to);
        if (rows.isEmpty()) {
            return new HrAttendanceReportResponse(List.of(), holidayDates, holidayNames);
        }

        // Batch-fetch the employee names for everyone appearing in
        // the range — one query instead of N per row.
        List<String> employeeIds = rows.stream()
            .map(EmployeeAttendance::getEmployeeId)
            .filter(id -> id != null && !id.isBlank())
            .distinct()
            .toList();
        Map<String, Teacher> byId = teacherRepo.findAllById(employeeIds).stream()
            .filter(t -> t.getDeletedAt() == null)
            .collect(Collectors.toMap(Teacher::getTeacherId, t -> t, (a, b) -> a));

        List<HrDailyAttendanceDto> out = new ArrayList<>(rows.size());
        for (EmployeeAttendance r : rows) {
            HrDailyAttendanceDto dto = new HrDailyAttendanceDto();
            dto.setAttendanceId(r.getAttendanceId());
            dto.setEmployeeId(r.getEmployeeId());
            Teacher t = byId.get(r.getEmployeeId());
            dto.setEmployeeName(t != null ? displayName(t) : "(deleted employee)");
            dto.setDesignation(t != null ? t.getEmployeeRole() : null);
            dto.setDate(r.getDate());
            dto.setStatus(r.getStatus());
            dto.setLate(r.isLate());
            dto.setInTime(r.getInTime());
            dto.setOutTime(r.getOutTime());
            dto.setSource(r.getSource());
            dto.setDistanceFromCampusMeters(r.getDistanceFromCampusMeters());
            dto.setMarkAccuracyMeters(r.getMarkAccuracyMeters());
            dto.setRemarks(r.getRemarks());
            out.add(dto);
        }
        return new HrAttendanceReportResponse(out, holidayDates, holidayNames);
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

            // On the IN punch we only know arrival, not duration —
            // so status starts at PRESENT (with the late flag if
            // arrival is past the tenant threshold). Half-day is
            // recomputed on OUT below using hours-worked, which is
            // the honest signal (an afternoon-only shift punching IN
            // at 13:00 shouldn't get flagged HALF_DAY by IN time).
            boolean isLate = isAfterOrEqual(when, settings.getLateThreshold());
            row.setStatus("PRESENT");
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
            // Recompute status now that duration is known — a short
            // shift becomes HALF_DAY per the tenant's hours rule.
            // Preserves LATE (via the boolean flag) so a late-and-
            // short shift shows both signals.
            applyHalfDayRule(existing, settings);
            repo.save(existing);
            log.info("Employee self-mark OUT: employee={} date={} status={}",
                employeeId, date, existing.getStatus());
            return MarkSelfResponse.from(existing, "OUT");
        }
        log.info("Employee re-mark ignored (both punches already set): employee={} date={}",
                employeeId, date);
        return MarkSelfResponse.from(existing, existing.getOutTime() != null ? "OUT" : "IN");
    }

    /**
     * Recompute PRESENT vs HALF_DAY on a row that now has both IN
     * and OUT stamped. Fires from every OUT-recording path (self-
     * mark, biometric, regularization) so the rule is applied
     * uniformly. Preserves an existing ABSENT status without
     * change — a row that was pre-stamped ABSENT and then gets a
     * belated punch is unusual enough to leave to HR to reconcile.
     */
    static void applyHalfDayRule(EmployeeAttendance row,
                                  EmployeeAttendanceSettings settings) {
        if (row == null || row.getInTime() == null || row.getOutTime() == null) return;
        if ("ABSENT".equalsIgnoreCase(row.getStatus())) return;
        if (!settings.isHalfDayCalculationEnabled()) {
            // Rule disabled — leave whatever we set on IN in place
            // (PRESENT, plus the late flag).
            row.setStatus("PRESENT");
            return;
        }
        double hoursWorked = Duration.between(row.getInTime(), row.getOutTime()).toMinutes() / 60.0;
        if (hoursWorked < settings.getHalfDayMaxHours()) {
            row.setStatus("HALF_DAY");
        } else {
            row.setStatus("PRESENT");
        }
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
