package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.hr.dto.RegularizationRequestDto;
import com.saas.school.modules.hr.dto.RegularizationReviewRequest;
import com.saas.school.modules.hr.dto.SubmitRegularizationRequest;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.model.RegularizationRequest;
import com.saas.school.modules.hr.model.RegularizationRequest.Status;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.hr.repository.RegularizationRequestRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Owns the regularization workflow — employee submits, service
 * enforces backdate + monthly cap, auto-approves inside the tenant's
 * grace window, otherwise HR reviews. Approval writes an
 * {@link EmployeeAttendance} row with {@code source=REGULARIZATION}.
 *
 * <p>All time comparisons run in Asia/Kolkata to match the rest of
 * the HR module; server can be on UTC without drift.</p>
 */
@Service
public class RegularizationService {

    private static final Logger log = LoggerFactory.getLogger(RegularizationService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired private RegularizationRequestRepository repo;
    @Autowired private EmployeeAttendanceRepository attendanceRepo;
    @Autowired private EmployeeAttendanceSettingsService settingsService;
    @Autowired private TeacherRepository teacherRepo;

    // ── Submit ──────────────────────────────────────────────────

    /**
     * Employee (or an HR user acting on their behalf) submits a
     * regularization request. Runs the auto-approve check inline;
     * if it passes, the attendance row is written immediately and
     * the request is stored as {@link Status#AUTO_APPROVED}. If
     * not, the request lands as {@link Status#PENDING} for HR
     * review.
     *
     * @throws BusinessException on backdate violation, monthly cap
     *   exceeded, duplicate submission for same (employee, date),
     *   missing both times, missing employee link, or tenant-level
     *   regularization disabled
     */
    public RegularizationRequestDto submit(String userId, SubmitRegularizationRequest req) {
        EmployeeAttendanceSettings settings = settingsService.getOrCreate();
        if (!settings.isRegularizationEnabled()) {
            throw new BusinessException(
                "Regularization requests are turned off for this school. "
              + "Ask HR to enable them on the Attendance Settings page.");
        }
        if (req == null) throw new BusinessException("Request payload is required.");
        if (req.getDate() == null) throw new BusinessException("Date is required.");
        if (req.getClaimedInTime() == null && req.getClaimedOutTime() == null) {
            throw new BusinessException(
                "At least one of IN or OUT time is required — fill in what you're claiming.");
        }
        if (req.getReason() == null || req.getReason().trim().isEmpty()) {
            throw new BusinessException("Reason is required so HR can review your request.");
        }

        Teacher employee = teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
            .orElseThrow(() -> new BusinessException(
                "Your account isn't linked to an employee record. Ask HR to link it."));
        String employeeId = employee.getTeacherId();

        // Backdate check — no requesting from before the tenant window.
        LocalDate today = LocalDate.now(ZONE);
        long ageDays = ChronoUnit.DAYS.between(req.getDate(), today);
        if (ageDays < 0) {
            throw new BusinessException("Can't regularize a future date.");
        }
        if (ageDays > settings.getRegularizationMaxBackdateDays()) {
            throw new BusinessException(
                "That date is " + ageDays + " days old — the limit is "
              + settings.getRegularizationMaxBackdateDays() + ". Ask HR to raise the "
              + "backdate limit or edit your attendance manually.");
        }

        // Idempotency: reject a duplicate submission for the same
        // (employee, date) that's not already REJECTED.
        List<RegularizationRequest> dupes = repo.findByEmployeeIdAndDateAndStatusIn(
            employeeId, req.getDate(),
            List.of(Status.PENDING, Status.APPROVED, Status.AUTO_APPROVED));
        if (!dupes.isEmpty()) {
            throw new BusinessException(
                "You already have a "
              + dupes.get(0).getStatus().name().toLowerCase().replace('_', ' ')
              + " request for " + req.getDate() + ".");
        }

        // Monthly cap check (0 = unlimited).
        int cap = settings.getRegularizationMonthlyCapPerEmployee();
        if (cap > 0) {
            LocalDate monthStart = req.getDate().withDayOfMonth(1);
            LocalDate monthEnd = req.getDate().withDayOfMonth(req.getDate().lengthOfMonth());
            long thisMonth = repo.countByEmployeeIdAndDateBetweenAndStatusIn(
                employeeId, monthStart, monthEnd,
                List.of(Status.PENDING, Status.APPROVED, Status.AUTO_APPROVED));
            if (thisMonth >= cap) {
                throw new BusinessException(
                    "You've already used your " + cap + " regularizations for this month.");
            }
        }

        // Build + persist. Auto-approve check runs against the
        // tenant-configured window: if the claimed IN is within N
        // minutes of the tenant's late-threshold, land as
        // AUTO_APPROVED and write the attendance row immediately.
        RegularizationRequest row = new RegularizationRequest();
        row.setId(UUID.randomUUID().toString());
        row.setTenantId(TenantContext.getTenantId());
        row.setEmployeeId(employeeId);
        row.setDate(req.getDate());
        row.setClaimedInTime(req.getClaimedInTime());
        row.setClaimedOutTime(req.getClaimedOutTime());
        row.setReason(req.getReason().trim());
        row.setSubmittedByUserId(userId);

        boolean autoApprove = qualifiesForAutoApprove(req, settings);
        if (autoApprove) {
            row.setStatus(Status.AUTO_APPROVED);
            row.setReviewedAt(Instant.now());
            row.setReviewNotes("Auto-approved (within " +
                settings.getRegularizationAutoApproveWindowMinutes() + "-min window)");
            RegularizationRequest saved = repo.save(row);
            applyToAttendance(saved, settings);
            log.info("Regularization auto-approved: employee={} date={}", employeeId, req.getDate());
            return toDto(saved, employee);
        }

        row.setStatus(Status.PENDING);
        RegularizationRequest saved = repo.save(row);
        log.info("Regularization queued: employee={} date={}", employeeId, req.getDate());
        return toDto(saved, employee);
    }

    // ── HR review ───────────────────────────────────────────────

    /** HR-only. Flips PENDING → APPROVED and writes the attendance
     *  row. Rejects a non-PENDING request with a clear message. */
    public RegularizationRequestDto approve(String requestId, String reviewerUserId,
                                             RegularizationReviewRequest review) {
        RegularizationRequest row = requireRequest(requestId);
        if (row.getStatus() != Status.PENDING) {
            throw new BusinessException(
                "Only pending requests can be approved. This one is "
              + row.getStatus().name().toLowerCase().replace('_', ' ') + ".");
        }
        row.setStatus(Status.APPROVED);
        row.setReviewedByUserId(reviewerUserId);
        row.setReviewedAt(Instant.now());
        if (review != null && review.getNotes() != null && !review.getNotes().isBlank()) {
            row.setReviewNotes(review.getNotes().trim());
        }
        RegularizationRequest saved = repo.save(row);

        EmployeeAttendanceSettings settings = settingsService.getOrCreate();
        applyToAttendance(saved, settings);
        log.info("Regularization approved by {}: employee={} date={}",
            reviewerUserId, row.getEmployeeId(), row.getDate());
        return toDto(saved, teacherRepo.findByTeacherIdAndDeletedAtIsNull(row.getEmployeeId()).orElse(null));
    }

    /** HR-only. Flips PENDING → REJECTED. Notes strongly encouraged
     *  (frontend prompts for it) so the employee sees why. */
    public RegularizationRequestDto reject(String requestId, String reviewerUserId,
                                            RegularizationReviewRequest review) {
        RegularizationRequest row = requireRequest(requestId);
        if (row.getStatus() != Status.PENDING) {
            throw new BusinessException(
                "Only pending requests can be rejected. This one is "
              + row.getStatus().name().toLowerCase().replace('_', ' ') + ".");
        }
        row.setStatus(Status.REJECTED);
        row.setReviewedByUserId(reviewerUserId);
        row.setReviewedAt(Instant.now());
        if (review != null && review.getNotes() != null && !review.getNotes().isBlank()) {
            row.setReviewNotes(review.getNotes().trim());
        }
        RegularizationRequest saved = repo.save(row);
        log.info("Regularization rejected by {}: employee={} date={}",
            reviewerUserId, row.getEmployeeId(), row.getDate());
        return toDto(saved, teacherRepo.findByTeacherIdAndDeletedAtIsNull(row.getEmployeeId()).orElse(null));
    }

    // ── Reads ───────────────────────────────────────────────────

    /** HR pending queue. */
    public List<RegularizationRequestDto> listPending() {
        return enrich(repo.findByStatusOrderByRequestedAtDesc(Status.PENDING));
    }

    /** HR history — approved / auto-approved / rejected. */
    public List<RegularizationRequestDto> listHistory() {
        return enrich(repo.findByStatusInOrderByReviewedAtDesc(
            List.of(Status.APPROVED, Status.AUTO_APPROVED, Status.REJECTED)));
    }

    /** Employee's own request history — every status, newest first. */
    public List<RegularizationRequestDto> listMy(String userId) {
        String employeeId = teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
            .map(Teacher::getTeacherId).orElse(null);
        if (employeeId == null) return List.of();
        return enrich(repo.findByEmployeeIdOrderByRequestedAtDesc(employeeId));
    }

    // ── Internals ───────────────────────────────────────────────

    /**
     * Auto-approve rule: the claimed IN time must be within
     * {@code settings.regularizationAutoApproveWindowMinutes} of
     * the tenant's late threshold. Late-arrival-by-a-hair claims
     * clear without HR review; wildly-off claims go to the queue.
     *
     * <p>Window of 0 disables auto-approval entirely — every
     * request goes to HR.</p>
     */
    private boolean qualifiesForAutoApprove(SubmitRegularizationRequest req,
                                             EmployeeAttendanceSettings settings) {
        int windowMinutes = settings.getRegularizationAutoApproveWindowMinutes();
        if (windowMinutes <= 0) return false;
        if (req.getClaimedInTime() == null) return false;

        try {
            LocalTime late = LocalTime.parse(settings.getLateThreshold());
            ZonedDateTime claimed = req.getClaimedInTime().atZone(ZONE);
            LocalTime claimedLocal = claimed.toLocalTime();
            long diffMinutes = Math.abs(ChronoUnit.MINUTES.between(late, claimedLocal));
            return diffMinutes <= windowMinutes;
        } catch (Exception e) {
            log.warn("Auto-approve check failed — treating as needs-review: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Apply an approved (auto or manual) request onto the day's
     * {@link EmployeeAttendance} row. Creates the row if missing,
     * otherwise overlays the claimed times. Always tags
     * {@code source=REGULARIZATION} so the daily view knows this
     * row didn't come from a real punch.
     */
    private void applyToAttendance(RegularizationRequest req,
                                    EmployeeAttendanceSettings settings) {
        EmployeeAttendance existing = attendanceRepo
            .findByEmployeeIdAndDate(req.getEmployeeId(), req.getDate()).orElse(null);
        EmployeeAttendance row = existing != null ? existing : new EmployeeAttendance();
        if (existing == null) {
            row.setAttendanceId(UUID.randomUUID().toString());
            row.setEmployeeId(req.getEmployeeId());
            row.setDate(req.getDate());
        }
        if (req.getClaimedInTime() != null) row.setInTime(req.getClaimedInTime());
        if (req.getClaimedOutTime() != null) row.setOutTime(req.getClaimedOutTime());

        // Late is a pure IN-time question — recompute from the
        // (possibly updated) IN time. Half-day is duration-based
        // now (see EmployeeAttendanceService.applyHalfDayRule) and
        // fires only when we have both IN + OUT.
        Instant effectiveIn = row.getInTime();
        if (effectiveIn != null) {
            row.setLate(isAfterOrEqual(effectiveIn, settings.getLateThreshold()));
            if (row.getStatus() == null || "ABSENT".equalsIgnoreCase(row.getStatus())) {
                row.setStatus("PRESENT");
            }
        } else if (row.getStatus() == null) {
            // Only OUT claimed and no prior IN — treat as PRESENT
            // rather than leaving the row orphaned in ABSENT.
            row.setStatus("PRESENT");
        }
        // Apply the hours-worked rule when both times are set.
        EmployeeAttendanceService.applyHalfDayRule(row, settings);

        row.setSource("REGULARIZATION");
        row.setMarkedByUserId("regularization:" + req.getId());
        row.setRemarks(req.getReason());
        attendanceRepo.save(row);
    }

    private static boolean isAfterOrEqual(Instant when, String hhmm) {
        if (when == null || hhmm == null || hhmm.isBlank()) return false;
        try {
            ZonedDateTime local = when.atZone(ZONE);
            LocalTime threshold = LocalTime.parse(hhmm);
            return !local.toLocalTime().isBefore(threshold);
        } catch (Exception e) {
            return false;
        }
    }

    private RegularizationRequest requireRequest(String id) {
        return repo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("RegularizationRequest", id));
    }

    private List<RegularizationRequestDto> enrich(List<RegularizationRequest> rows) {
        if (rows.isEmpty()) return List.of();
        List<String> ids = rows.stream().map(RegularizationRequest::getEmployeeId).distinct().toList();
        Map<String, Teacher> byId = teacherRepo.findAllById(ids).stream()
            .filter(t -> t.getDeletedAt() == null)
            .collect(Collectors.toMap(Teacher::getTeacherId, t -> t, (a, b) -> a));
        List<RegularizationRequestDto> out = new ArrayList<>(rows.size());
        for (RegularizationRequest r : rows) {
            out.add(toDto(r, byId.get(r.getEmployeeId())));
        }
        return out;
    }

    private RegularizationRequestDto toDto(RegularizationRequest r, Teacher employee) {
        String name = employee == null ? "(deleted employee)" : displayName(employee);
        String designation = employee == null ? null : employee.getEmployeeRole();
        return RegularizationRequestDto.fromEntity(r, name, designation);
    }

    private static String displayName(Teacher t) {
        String first = t.getFirstName() == null ? "" : t.getFirstName().trim();
        String last  = t.getLastName() == null ? "" : t.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (t.getEmployeeId() != null) return "Emp " + t.getEmployeeId();
        return t.getTeacherId();
    }
}
