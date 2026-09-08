package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.hr.dto.LeaveApplicationDto;
import com.saas.school.modules.hr.dto.LeaveBalanceDto;
import com.saas.school.modules.hr.dto.LeaveReviewRequest;
import com.saas.school.modules.hr.dto.SubmitLeaveRequest;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.LeaveApplication;
import com.saas.school.modules.hr.model.LeaveBalance;
import com.saas.school.modules.hr.model.LeaveType;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.hr.repository.LeaveApplicationRepository;
import com.saas.school.modules.hr.repository.LeaveBalanceRepository;
import com.saas.school.modules.hr.repository.LeaveTypeRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Owns the leave workflow — employee submits, HR reviews, approval
 * side-effects update attendance + balance in one transaction-shape
 * pass. Modeled on {@link RegularizationService}: mostly the same
 * lifecycle, extra work at approve-time (multi-day fanout) and at
 * cancel-time (undo).
 *
 * <p>Attendance integration: approving a leave writes one
 * {@link EmployeeAttendance} row per day in the requested range,
 * status=ON_LEAVE, source=LEAVE, markedByUserId=leave:&lt;id&gt;.
 * That marker prefix lets cancel identify + delete only the rows this
 * leave inserted (not touching any manual / biometric row that might
 * have somehow landed on the same day beforehand — safety first).</p>
 *
 * <p>Balance integration: approve increments {@code used}, cancel of
 * an approved-and-not-yet-started leave decrements it. Approved
 * leaves already started can still be cancelled but only rows for
 * future dates are undone — the past days' attendance stays as
 * ON_LEAVE and the balance keeps those days as consumed.</p>
 */
@Service
public class LeaveService {

    private static final Logger log = LoggerFactory.getLogger(LeaveService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired private LeaveApplicationRepository leaveRepo;
    @Autowired private LeaveTypeRepository typeRepo;
    @Autowired private LeaveBalanceRepository balanceRepo;
    @Autowired private EmployeeAttendanceRepository attendanceRepo;
    @Autowired private TeacherRepository teacherRepo;

    // ── Submit ─────────────────────────────────────────────────

    /**
     * Employee submits a leave request. Validates payload + date sanity,
     * checks for overlap with existing non-rejected leaves, checks
     * balance sufficiency (soft — allows exhausting into 0 remaining,
     * blocks going negative unless the leave type is uncapped), then
     * saves as {@link LeaveApplication.Status#PENDING} for HR review.
     *
     * <p>No auto-approve for leave — every leave goes through HR
     * (matches how most schools want it; a same-day sick leave can
     * always be filed as a regularization if the employee is well
     * enough to log in after).</p>
     */
    public LeaveApplicationDto submit(String userId, SubmitLeaveRequest req) {
        if (req == null) throw new BusinessException("Request payload is required.");
        String employeeId = resolveEmployeeId(userId);
        if (employeeId == null) {
            throw new BusinessException(
                "This account isn't linked to an employee record. Contact HR.");
        }
        validateShape(req);

        String code = req.getLeaveTypeCode().trim().toUpperCase();
        LeaveType type = typeRepo.findByCode(code).orElseThrow(() ->
            new BusinessException("Unknown leave type: " + code));
        if (!type.isActive()) {
            throw new BusinessException("Leave type '" + type.getName() + "' is currently disabled.");
        }

        LocalDate start = req.getStartDate();
        LocalDate end = req.getEndDate();
        if (end.isBefore(start)) {
            throw new BusinessException("End date can't be before start date.");
        }

        boolean startHalf = req.isStartHalf();
        boolean endHalf = req.isEndHalf() && !start.equals(end); // single-day → only startHalf
        double days = computeDays(start, end, startHalf, endHalf);
        if (days <= 0) {
            throw new BusinessException("Leave duration comes out to 0 days — check the half-day toggles.");
        }

        // Overlap check — non-rejected leaves that intersect the new
        // range are hard blockers. Cancelled rows are excluded so a
        // freshly-cancelled leave doesn't stop the re-apply.
        List<LeaveApplication.Status> blockers = List.of(
            LeaveApplication.Status.PENDING, LeaveApplication.Status.APPROVED);
        List<LeaveApplication> overlaps = leaveRepo
            .findByEmployeeIdAndStatusInAndEndDateGreaterThanEqualAndStartDateLessThanEqual(
                employeeId, blockers, start, end);
        if (!overlaps.isEmpty()) {
            LeaveApplication first = overlaps.get(0);
            throw new BusinessException(String.format(
                "You already have a %s leave for %s to %s — cancel that first if you want to re-apply.",
                first.getStatus().name().toLowerCase(),
                first.getStartDate(), first.getEndDate()));
        }

        // Balance check — soft rule: capped types with 0 remaining
        // reject; uncapped types (defaultAnnualQuota <= 0 typically
        // LOP) never reject on balance.
        int year = start.getYear();
        LeaveBalance balance = getOrProvisionBalance(employeeId, year, code, type);
        boolean uncapped = type.getDefaultAnnualQuota() <= 0 && balance.getAllocated() <= 0;
        if (!uncapped && (balance.getRemaining() - days) < 0) {
            throw new BusinessException(String.format(
                "Insufficient %s balance: %.1f day%s remaining, %.1f day%s requested.",
                code, balance.getRemaining(), pluralS(balance.getRemaining()),
                days, pluralS(days)));
        }

        LeaveApplication row = new LeaveApplication();
        row.setId(UUID.randomUUID().toString());
        row.setTenantId(TenantContext.getTenantId());
        row.setEmployeeId(employeeId);
        row.setLeaveTypeCode(code);
        row.setStartDate(start);
        row.setEndDate(end);
        row.setStartHalf(startHalf);
        row.setEndHalf(endHalf);
        row.setDays(days);
        row.setReason(req.getReason().trim());
        row.setStatus(LeaveApplication.Status.PENDING);
        row.setSubmittedByUserId(userId);
        row.setRequestedAt(Instant.now());
        LeaveApplication saved = leaveRepo.save(row);
        log.info("Leave submitted: id={} employee={} type={} {}→{} days={}",
            saved.getId(), employeeId, code, start, end, days);
        return toDto(saved, teacherRepo.findById(employeeId).orElse(null), type);
    }

    // ── Approve / Reject / Cancel ─────────────────────────────

    /**
     * HR approves a PENDING leave. Writes ON_LEAVE attendance rows
     * across the date range, deducts from the balance, stamps the
     * review fields. Idempotent per row — re-approving a row that's
     * already APPROVED is a no-op (returns the enriched DTO).
     */
    public LeaveApplicationDto approve(String id, String reviewerUserId, LeaveReviewRequest review) {
        LeaveApplication row = require(id);
        if (row.getStatus() != LeaveApplication.Status.PENDING) {
            throw new BusinessException(
                "Leave already " + row.getStatus().name().toLowerCase() + ".");
        }
        LeaveType type = typeRepo.findByCode(row.getLeaveTypeCode()).orElseThrow(() ->
            new BusinessException("Leave type '" + row.getLeaveTypeCode() + "' no longer exists."));

        writeAttendanceRows(row);
        adjustBalance(row, +row.getDays());

        row.setStatus(LeaveApplication.Status.APPROVED);
        row.setReviewedByUserId(reviewerUserId);
        row.setReviewedAt(Instant.now());
        if (review != null && review.getNotes() != null) row.setReviewNotes(review.getNotes().trim());
        LeaveApplication saved = leaveRepo.save(row);
        log.info("Leave approved: id={} employee={} days={}",
            saved.getId(), saved.getEmployeeId(), saved.getDays());
        return toDto(saved, teacherRepo.findById(saved.getEmployeeId()).orElse(null), type);
    }

    public LeaveApplicationDto reject(String id, String reviewerUserId, LeaveReviewRequest review) {
        LeaveApplication row = require(id);
        if (row.getStatus() != LeaveApplication.Status.PENDING) {
            throw new BusinessException(
                "Leave already " + row.getStatus().name().toLowerCase() + ".");
        }
        if (review == null || review.getNotes() == null || review.getNotes().trim().isEmpty()) {
            throw new BusinessException("Please give a reason so the employee understands the decision.");
        }
        row.setStatus(LeaveApplication.Status.REJECTED);
        row.setReviewedByUserId(reviewerUserId);
        row.setReviewedAt(Instant.now());
        row.setReviewNotes(review.getNotes().trim());
        LeaveApplication saved = leaveRepo.save(row);
        LeaveType type = typeRepo.findByCode(saved.getLeaveTypeCode()).orElse(null);
        log.info("Leave rejected: id={} employee={}", saved.getId(), saved.getEmployeeId());
        return toDto(saved, teacherRepo.findById(saved.getEmployeeId()).orElse(null), type);
    }

    /**
     * Employee-initiated cancel. Rules:
     * <ul>
     *   <li>PENDING → always cancellable, no side effects.</li>
     *   <li>APPROVED and start date is in the future → cancellable;
     *       we delete every attendance row this leave inserted and
     *       refund the balance in full.</li>
     *   <li>APPROVED and start date is today / in the past → partial:
     *       we undo only future dates and refund proportionally
     *       (0.5 per half-day, 1.0 per full day). Past days stay as
     *       ON_LEAVE and remain consumed.</li>
     *   <li>Already REJECTED / CANCELLED → BusinessException.</li>
     * </ul>
     * Ownership is enforced by the controller — caller passes the
     * requesting {@code userId} and we compare to the row's
     * submittedByUserId.
     */
    public LeaveApplicationDto cancel(String id, String requestingUserId) {
        LeaveApplication row = require(id);
        if (!requestingUserId.equals(row.getSubmittedByUserId())) {
            throw new BusinessException("You can only cancel your own leaves.");
        }
        if (row.getStatus() == LeaveApplication.Status.REJECTED
                || row.getStatus() == LeaveApplication.Status.CANCELLED) {
            throw new BusinessException("Leave already " + row.getStatus().name().toLowerCase() + ".");
        }

        double refund = 0.0;
        if (row.getStatus() == LeaveApplication.Status.APPROVED) {
            LocalDate today = LocalDate.now(ZONE);
            List<EmployeeAttendance> generated = findGeneratedRows(row);
            List<EmployeeAttendance> toDelete = new ArrayList<>();
            for (EmployeeAttendance r : generated) {
                if (!r.getDate().isBefore(today)) {
                    toDelete.add(r);
                    refund += weightForDate(r.getDate(), row);
                }
            }
            if (!toDelete.isEmpty()) attendanceRepo.deleteAll(toDelete);
            if (refund > 0) adjustBalance(row, -refund);
        }

        row.setStatus(LeaveApplication.Status.CANCELLED);
        row.setCancelledAt(Instant.now());
        LeaveApplication saved = leaveRepo.save(row);
        LeaveType type = typeRepo.findByCode(saved.getLeaveTypeCode()).orElse(null);
        log.info("Leave cancelled: id={} employee={} refundDays={}",
            saved.getId(), saved.getEmployeeId(), refund);
        return toDto(saved, teacherRepo.findById(saved.getEmployeeId()).orElse(null), type);
    }

    // ── Reads ──────────────────────────────────────────────────

    public List<LeaveApplicationDto> listPending() {
        return enrich(leaveRepo.findByStatusOrderByRequestedAtDesc(LeaveApplication.Status.PENDING));
    }

    public List<LeaveApplicationDto> listHistory() {
        return enrich(leaveRepo.findByStatusInOrderByRequestedAtDesc(EnumSet.of(
            LeaveApplication.Status.APPROVED,
            LeaveApplication.Status.REJECTED,
            LeaveApplication.Status.CANCELLED)));
    }

    public List<LeaveApplicationDto> listMy(String userId) {
        String employeeId = resolveEmployeeId(userId);
        if (employeeId == null) return List.of();
        return enrich(leaveRepo.findByEmployeeIdOrderByRequestedAtDesc(employeeId));
    }

    /**
     * Employee's balance sheet for a given year. Lazily provisions
     * a row for every active leave type — so first-time reads on a
     * fresh year still populate a full grid rather than an empty
     * one. Inactive types are only surfaced if there's already a
     * saved row for them (historical continuity).
     */
    public List<LeaveBalanceDto> getBalanceForUser(String userId, int year) {
        String employeeId = resolveEmployeeId(userId);
        if (employeeId == null) return List.of();
        return getBalanceForEmployee(employeeId, year);
    }

    public List<LeaveBalanceDto> getBalanceForEmployee(String employeeId, int year) {
        List<LeaveType> types = typeRepo.findAllByOrderBySortOrderAscNameAsc();
        Map<String, LeaveType> byCode = types.stream()
            .collect(Collectors.toMap(LeaveType::getCode, t -> t, (a, b) -> a));

        // Provision missing rows for active types so the widget shows
        // the full spread on first read.
        for (LeaveType t : types) {
            if (!t.isActive()) continue;
            getOrProvisionBalance(employeeId, year, t.getCode(), t);
        }
        List<LeaveBalance> rows = balanceRepo.findByEmployeeIdAndYear(employeeId, year);
        return rows.stream()
            .sorted((a, b) -> {
                LeaveType ta = byCode.get(a.getLeaveTypeCode());
                LeaveType tb = byCode.get(b.getLeaveTypeCode());
                int oa = ta != null ? ta.getSortOrder() : Integer.MAX_VALUE;
                int ob = tb != null ? tb.getSortOrder() : Integer.MAX_VALUE;
                return Integer.compare(oa, ob);
            })
            .map(b -> {
                LeaveType t = byCode.get(b.getLeaveTypeCode());
                String name = t != null ? t.getName() : b.getLeaveTypeCode();
                boolean active = t != null && t.isActive();
                return LeaveBalanceDto.fromEntity(b, name, active);
            })
            .toList();
    }

    // ── Internals ──────────────────────────────────────────────

    private void validateShape(SubmitLeaveRequest req) {
        if (req.getLeaveTypeCode() == null || req.getLeaveTypeCode().isBlank()) {
            throw new BusinessException("Leave type is required.");
        }
        if (req.getStartDate() == null) throw new BusinessException("Start date is required.");
        if (req.getEndDate() == null) throw new BusinessException("End date is required.");
        if (req.getReason() == null || req.getReason().trim().isEmpty()) {
            throw new BusinessException("Reason is required.");
        }
    }

    /** Full day = 1.0, half day on either boundary shaves 0.5.
     *  Single-day leave with startHalf=true is 0.5. */
    private static double computeDays(LocalDate start, LocalDate end, boolean startHalf, boolean endHalf) {
        long spanned = end.toEpochDay() - start.toEpochDay() + 1;
        double days = spanned;
        if (startHalf) days -= 0.5;
        if (endHalf) days -= 0.5;
        return days;
    }

    /** Per-date weight used at cancel-refund time. Boundary dates
     *  may be halves; interior dates are always full. */
    private static double weightForDate(LocalDate d, LeaveApplication row) {
        if (d.equals(row.getStartDate()) && row.isStartHalf()) return 0.5;
        if (d.equals(row.getEndDate()) && row.isEndHalf() && !row.getStartDate().equals(row.getEndDate())) return 0.5;
        return 1.0;
    }

    /** Upsert one attendance row per date in the leave range.
     *  Existing rows on the same date are overwritten to ON_LEAVE —
     *  matches how Regularization overwrites; the marker + audit
     *  trail on the leave row itself is the source of truth. */
    private void writeAttendanceRows(LeaveApplication row) {
        String marker = "leave:" + row.getId();
        for (LocalDate d = row.getStartDate(); !d.isAfter(row.getEndDate()); d = d.plusDays(1)) {
            EmployeeAttendance existing = attendanceRepo
                .findByEmployeeIdAndDate(row.getEmployeeId(), d).orElse(null);
            EmployeeAttendance att = existing != null ? existing : new EmployeeAttendance();
            if (existing == null) {
                att.setAttendanceId(UUID.randomUUID().toString());
                att.setEmployeeId(row.getEmployeeId());
                att.setDate(d);
            }
            att.setStatus("ON_LEAVE");
            att.setSource("LEAVE");
            att.setInTime(null);
            att.setOutTime(null);
            att.setLate(false);
            att.setMarkedByUserId(marker);
            att.setRemarks(row.getLeaveTypeCode() + ": " + row.getReason());
            attendanceRepo.save(att);
        }
    }

    /** Delete only attendance rows we generated for this leave.
     *  Identified by the {@code leave:<id>} marker so we never touch
     *  a manual / biometric / regularization row that might coexist. */
    private List<EmployeeAttendance> findGeneratedRows(LeaveApplication row) {
        String marker = "leave:" + row.getId();
        List<EmployeeAttendance> range = attendanceRepo
            .findByEmployeeIdAndDateBetween(row.getEmployeeId(), row.getStartDate(), row.getEndDate());
        List<EmployeeAttendance> mine = new ArrayList<>();
        for (EmployeeAttendance r : range) {
            if (marker.equals(r.getMarkedByUserId())) mine.add(r);
        }
        return mine;
    }

    /** Balance mutate helper — positive delta = consume, negative = refund. */
    private void adjustBalance(LeaveApplication row, double delta) {
        LeaveType type = typeRepo.findByCode(row.getLeaveTypeCode()).orElse(null);
        LeaveBalance b = getOrProvisionBalance(row.getEmployeeId(),
            row.getStartDate().getYear(), row.getLeaveTypeCode(), type);
        b.setUsed(Math.max(0, b.getUsed() + delta));
        b.setUpdatedAt(Instant.now());
        balanceRepo.save(b);
    }

    /** Read-or-create the balance row for a given (employee, year,
     *  code). Uses the type's defaultAnnualQuota as the initial
     *  allocation. Safe to call multiple times — the unique index
     *  makes duplicate provisioning race-safe (second one just re-reads). */
    LeaveBalance getOrProvisionBalance(String employeeId, int year, String code, LeaveType type) {
        return balanceRepo.findByEmployeeIdAndYearAndLeaveTypeCode(employeeId, year, code)
            .orElseGet(() -> {
                LeaveBalance b = new LeaveBalance(
                    TenantContext.getTenantId(), employeeId, year, code,
                    type != null ? type.getDefaultAnnualQuota() : 0.0);
                try {
                    return balanceRepo.save(b);
                } catch (org.springframework.dao.DuplicateKeyException dup) {
                    // Race with another concurrent provision — re-read.
                    return balanceRepo.findByEmployeeIdAndYearAndLeaveTypeCode(employeeId, year, code)
                        .orElseThrow(() -> dup);
                }
            });
    }

    private String resolveEmployeeId(String userId) {
        return teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
            .map(Teacher::getTeacherId).orElse(null);
    }

    private LeaveApplication require(String id) {
        return leaveRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("LeaveApplication", id));
    }

    private List<LeaveApplicationDto> enrich(List<LeaveApplication> rows) {
        if (rows.isEmpty()) return List.of();
        List<String> empIds = rows.stream().map(LeaveApplication::getEmployeeId).distinct().toList();
        List<String> codes = rows.stream().map(LeaveApplication::getLeaveTypeCode).distinct().toList();
        Map<String, Teacher> teachers = teacherRepo.findAllById(empIds).stream()
            .filter(t -> t.getDeletedAt() == null)
            .collect(Collectors.toMap(Teacher::getTeacherId, t -> t, (a, b) -> a));
        Map<String, LeaveType> types = codes.stream()
            .map(c -> typeRepo.findByCode(c).orElse(null))
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toMap(LeaveType::getCode, t -> t, (a, b) -> a));
        List<LeaveApplicationDto> out = new ArrayList<>(rows.size());
        for (LeaveApplication r : rows) {
            out.add(toDto(r, teachers.get(r.getEmployeeId()), types.get(r.getLeaveTypeCode())));
        }
        return out;
    }

    private LeaveApplicationDto toDto(LeaveApplication row, Teacher employee, LeaveType type) {
        String name = employee == null ? "(deleted employee)" : displayName(employee);
        String designation = employee == null ? null : employee.getEmployeeRole();
        String typeName = type != null ? type.getName() : row.getLeaveTypeCode();
        return LeaveApplicationDto.fromEntity(row, name, designation, typeName);
    }

    private static String displayName(Teacher t) {
        String first = t.getFirstName() == null ? "" : t.getFirstName().trim();
        String last  = t.getLastName() == null ? "" : t.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (t.getEmployeeId() != null) return "Emp " + t.getEmployeeId();
        return t.getTeacherId();
    }

    private static String pluralS(double n) { return Math.abs(n - 1.0) < 0.001 ? "" : "s"; }
}
