package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.hr.dto.EmployeeLeaveBalanceSheet;
import com.saas.school.modules.hr.dto.LeaveApplicationDto;
import com.saas.school.modules.hr.dto.LeaveBalanceDto;
import com.saas.school.modules.hr.dto.LeaveReviewRequest;
import com.saas.school.modules.hr.dto.OverrideBalanceRequest;
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

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    @Autowired private AcademicYearRepository academicYearRepo;
    /** Used only for {@link EmployeeAttendanceService#getHolidaysInRange}
     *  — no circular risk (attendance service doesn't reach into
     *  the leave module). Kept optional (required=false) so unit
     *  tests that don't stand up the whole HR module still boot. */
    @Autowired(required = false) private EmployeeAttendanceService attendanceService;

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

        // Gender restriction (applicableGender) is captured on the
        // type but not runtime-enforced yet — Teacher doesn't carry a
        // gender field today, so we'd have to null-guess. The UI shows
        // "Applicable to: Female employees only" so HR can enforce
        // out-of-band; a later phase can add Teacher.gender and flip
        // this to a hard block.

        // Notice-period check — how many days in advance the type
        // requires. Same-day sick leave has notice=0 so it's always
        // allowed. Uses IST (matches every other date comparison in
        // the HR module).
        int notice = type.getMinAdvanceDays();
        if (notice > 0) {
            LocalDate today = LocalDate.now(ZONE);
            long daysUntilStart = start.toEpochDay() - today.toEpochDay();
            if (daysUntilStart < notice) {
                throw new BusinessException(String.format(
                    "%s requires at least %d day%s advance notice — earliest start date is %s.",
                    type.getName(), notice, notice == 1 ? "" : "s",
                    today.plusDays(notice)));
            }
        }

        boolean startHalf = req.isStartHalf();
        boolean endHalf = req.isEndHalf() && !start.equals(end); // single-day → only startHalf

        // Exclude Sundays + tenant-declared holidays from the day count
        // AND from the ON_LEAVE attendance rows we write later. Applying
        // leave for a range that includes a public holiday shouldn't
        // consume any leave balance on that holiday — the employee
        // isn't expected to work that day anyway. If the entire range
        // is off-days, the request has nothing to do so we reject it.
        Set<LocalDate> holidayDates = loadHolidayDates(start, end);
        double days = computeEffectiveDays(start, end, startHalf, endHalf, holidayDates);
        if (days <= 0) {
            throw new BusinessException(
                "Every day in your selected range is either a Sunday or a declared "
              + "holiday — no leave to apply for. Pick a range with at least one working day.");
        }

        // Max-consecutive check — prevents "6-month sabbatical via CL".
        // Uses ceiling so a request of "3.5 days" against a max of 3
        // still trips the check. 0 = uncapped.
        int maxConsecutive = type.getMaxConsecutiveDays();
        if (maxConsecutive > 0 && days > maxConsecutive) {
            throw new BusinessException(String.format(
                "%s allows a maximum of %d consecutive working day%s per application.",
                type.getName(), maxConsecutive, maxConsecutive == 1 ? "" : "s"));
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
        // LOP) never reject on balance. Balance is keyed on the
        // school's academic year the LEAVE STARTS in — matches how
        // HR bookkeeping treats leave for a year that spans a
        // rollover (leave counts against the year it started in).
        String academicYearId = resolveAcademicYearForDate(start);
        LeaveBalance balance = getOrProvisionBalance(employeeId, academicYearId, code, type);
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

        // Re-resolve off-days at approve time — the holiday calendar
        // may have gained/lost entries between submit and approve.
        // Recompute {@code days} from the current holiday set so the
        // balance deduction matches what we actually write. If every
        // day is now off (rare — holiday added after submit), reject
        // rather than deducting nothing but marking the leave APPROVED.
        Set<LocalDate> holidayDates = loadHolidayDates(row.getStartDate(), row.getEndDate());
        double effectiveDays = computeEffectiveDays(row.getStartDate(), row.getEndDate(),
            row.isStartHalf(), row.isEndHalf(), holidayDates);
        if (effectiveDays <= 0) {
            throw new BusinessException(
                "The requested range is now entirely holidays / Sundays — "
              + "no working days to approve. Reject the request instead.");
        }
        row.setDays(effectiveDays);

        writeAttendanceRows(row, holidayDates);
        adjustBalance(row, +effectiveDays);

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
                    // Attendance rows exist only for working days
                    // (writeAttendanceRows skipped off-days), so the
                    // boundary weight is the entire per-day cost.
                    refund += boundaryWeight(r.getDate(), row.getStartDate(),
                        row.getEndDate(), row.isStartHalf(), row.isEndHalf());
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
     * Employee's balance sheet for a given academic year. Lazily
     * provisions a row for every active leave type — so first-time
     * reads on a fresh year still populate a full grid rather than
     * an empty one. Inactive types are only surfaced if there's
     * already a saved row for them (historical continuity).
     *
     * <p>When {@code academicYearId} is null we resolve the tenant's
     * current academic year — the common case for the "just show me
     * my balance right now" widget on My Leave.</p>
     */
    public List<LeaveBalanceDto> getBalanceForUser(String userId, String academicYearId) {
        String employeeId = resolveEmployeeId(userId);
        if (employeeId == null) return List.of();
        return getBalanceForEmployee(employeeId, academicYearId);
    }

    /**
     * HR-side view — every active employee's full balance sheet for
     * a given academic year. Provisions missing rows lazily so a
     * freshly-onboarded teacher shows up with default quotas
     * immediately.
     */
    public List<EmployeeLeaveBalanceSheet> getAllEmployeeBalances(String academicYearId) {
        String ayId = academicYearId != null ? academicYearId : resolveCurrentAcademicYearId();
        // TeacherRepository doesn't expose an unpaged findByDeletedAtIsNull;
        // findAll() + client-side soft-delete filter is fine at the
        // scale HR employee lists live at (dozens, not thousands).
        List<Teacher> employees = teacherRepo.findAll().stream()
            .filter(t -> t.getDeletedAt() == null)
            .toList();
        List<EmployeeLeaveBalanceSheet> sheets = new ArrayList<>();
        for (Teacher e : employees) {
            String empId = e.getTeacherId();
            if (empId == null) continue;
            List<LeaveBalanceDto> balances = getBalanceForEmployee(empId, ayId);
            sheets.add(new EmployeeLeaveBalanceSheet(
                empId, displayName(e), e.getEmployeeRole(), balances));
        }
        return sheets;
    }

    /**
     * HR overrides one specific (employee, academicYear, type) balance
     * row — useful for senior teachers getting extra EL, mid-year
     * joiners on a pro-rated quota, or a data-cleanup correction.
     * Only mutates fields that are non-null on the request; each
     * mutation stamps updatedAt so the audit trail stays truthful.
     */
    public LeaveBalanceDto overrideBalance(String employeeId, String academicYearId,
                                            String code, OverrideBalanceRequest req) {
        String ayId = academicYearId != null ? academicYearId : resolveCurrentAcademicYearId();
        LeaveType type = typeRepo.findByCode(code).orElseThrow(() ->
            new BusinessException("Leave type '" + code + "' doesn't exist."));
        LeaveBalance b = getOrProvisionBalance(employeeId, ayId, code, type);
        if (req.getAllocated() != null) b.setAllocated(Math.max(0, req.getAllocated()));
        if (req.getCarryForwardIn() != null) b.setCarryForwardIn(Math.max(0, req.getCarryForwardIn()));
        if (req.getUsed() != null) b.setUsed(Math.max(0, req.getUsed()));
        b.setUpdatedAt(Instant.now());
        LeaveBalance saved = balanceRepo.save(b);
        log.info("Balance overridden: employee={} ayId={} type={} allocated={} carryFwd={} used={}",
            employeeId, ayId, code, saved.getAllocated(), saved.getCarryForwardIn(), saved.getUsed());
        return LeaveBalanceDto.fromEntity(saved, type);
    }

    public List<LeaveBalanceDto> getBalanceForEmployee(String employeeId, String academicYearId) {
        String ayId = academicYearId != null ? academicYearId : resolveCurrentAcademicYearId();
        List<LeaveType> types = typeRepo.findAllByOrderBySortOrderAscNameAsc();
        Map<String, LeaveType> byCode = types.stream()
            .collect(Collectors.toMap(LeaveType::getCode, t -> t, (a, b) -> a));

        // Provision missing rows for active types so the widget shows
        // the full spread on first read.
        for (LeaveType t : types) {
            if (!t.isActive()) continue;
            getOrProvisionBalance(employeeId, ayId, t.getCode(), t);
        }
        List<LeaveBalance> rows = balanceRepo.findByEmployeeIdAndAcademicYearId(employeeId, ayId);
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
                return LeaveBalanceDto.fromEntity(b, t);
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

    /** Effective days = sum of per-date weights for every WORKING date
     *  in the range (Sundays + holidays excluded). Half-days on either
     *  boundary contribute 0.5 instead of 1.0, but only if that
     *  boundary date is itself a working day — a half-day toggle on a
     *  Sunday boundary is silently a no-op (Sunday doesn't consume
     *  balance at all). */
    private static double computeEffectiveDays(LocalDate start, LocalDate end,
                                                boolean startHalf, boolean endHalf,
                                                Set<LocalDate> holidayDates) {
        double days = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            if (!isWorkingDay(d, holidayDates)) continue;
            days += boundaryWeight(d, start, end, startHalf, endHalf);
        }
        return days;
    }

    /** Working = not Sunday AND not in the holiday set. Matches how
     *  the frontend My Attendance calendar renders off-days. */
    private static boolean isWorkingDay(LocalDate d, Set<LocalDate> holidayDates) {
        if (d.getDayOfWeek() == DayOfWeek.SUNDAY) return false;
        if (holidayDates.contains(d)) return false;
        return true;
    }

    /** Per-date weight (1.0 or 0.5) — pure math, doesn't check
     *  working-day status. Callers must gate with {@link #isWorkingDay}
     *  first. */
    private static double boundaryWeight(LocalDate d, LocalDate start, LocalDate end,
                                          boolean startHalf, boolean endHalf) {
        boolean singleDay = start.equals(end);
        if (d.equals(start) && startHalf) return 0.5;
        if (d.equals(end) && endHalf && !singleDay) return 0.5;
        return 1.0;
    }

    /** Load tenant-declared holiday dates in the range as a set for
     *  O(1) contains checks. Returns empty set if the attendance
     *  service isn't wired (unit tests, or a bare-bones tenant with
     *  no events collection). */
    private Set<LocalDate> loadHolidayDates(LocalDate from, LocalDate to) {
        if (attendanceService == null) return Set.of();
        try {
            List<LocalDate> dates = attendanceService.getHolidaysInRange(from, to).getHolidayDates();
            return dates == null ? Set.of() : new HashSet<>(dates);
        } catch (Exception e) {
            log.warn("Holiday load failed for range {} → {}: {}", from, to, e.getMessage());
            return Set.of();
        }
    }

    /** Upsert one attendance row per WORKING date in the leave range
     *  (Sundays + declared holidays skipped — those days don't count
     *  against balance and marking them ON_LEAVE would clutter the
     *  calendar with purple over an already-tinted holiday cell).
     *  Existing rows on the same date are overwritten to ON_LEAVE —
     *  matches how Regularization overwrites; the marker + audit
     *  trail on the leave row itself is the source of truth. */
    private void writeAttendanceRows(LeaveApplication row, Set<LocalDate> holidayDates) {
        String marker = "leave:" + row.getId();
        for (LocalDate d = row.getStartDate(); !d.isAfter(row.getEndDate()); d = d.plusDays(1)) {
            if (!isWorkingDay(d, holidayDates)) continue;
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

    /** Balance mutate helper — positive delta = consume, negative =
     *  refund. Also mirrors the delta into {@link LeaveBalance#getMandatoryUsed()}
     *  when the type has a {@code mandatoryPerYear} threshold, capped
     *  at that threshold so a heavy user isn't double-counted. */
    private void adjustBalance(LeaveApplication row, double delta) {
        LeaveType type = typeRepo.findByCode(row.getLeaveTypeCode()).orElse(null);
        String ayId = resolveAcademicYearForDate(row.getStartDate());
        LeaveBalance b = getOrProvisionBalance(row.getEmployeeId(),
            ayId, row.getLeaveTypeCode(), type);
        b.setUsed(Math.max(0, b.getUsed() + delta));
        if (type != null && type.getMandatoryPerYear() > 0) {
            double newMandatory = b.getMandatoryUsed() + delta;
            newMandatory = Math.max(0, Math.min(newMandatory, type.getMandatoryPerYear()));
            b.setMandatoryUsed(newMandatory);
        }
        b.setUpdatedAt(Instant.now());
        balanceRepo.save(b);
    }

    /** Read-or-create the balance row for a given (employee, year,
     *  code). Uses the type's defaultAnnualQuota as the initial
     *  allocation. Safe to call multiple times — the unique index
     *  makes duplicate provisioning race-safe (second one just re-reads). */
    LeaveBalance getOrProvisionBalance(String employeeId, String academicYearId,
                                        String code, LeaveType type) {
        return balanceRepo.findByEmployeeIdAndAcademicYearIdAndLeaveTypeCode(
                employeeId, academicYearId, code)
            .orElseGet(() -> {
                LeaveBalance b = new LeaveBalance(
                    TenantContext.getTenantId(), employeeId, academicYearId, code,
                    type != null ? type.getDefaultAnnualQuota() : 0.0);
                try {
                    return balanceRepo.save(b);
                } catch (org.springframework.dao.DuplicateKeyException dup) {
                    // Race with another concurrent provision — re-read.
                    return balanceRepo.findByEmployeeIdAndAcademicYearIdAndLeaveTypeCode(
                            employeeId, academicYearId, code)
                        .orElseThrow(() -> dup);
                }
            });
    }

    private String resolveEmployeeId(String userId) {
        return teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
            .map(Teacher::getTeacherId).orElse(null);
    }

    /**
     * Resolve the academic year for a given date — falls back to the
     * tenant's current academic year when the date isn't inside any
     * declared range. Used for submit-time balance keying so a leave
     * that spans a year rollover consumes from the year the leave
     * STARTS in (matches how HR bookkeeping works — leave "belongs"
     * to the year the employee left).
     */
    String resolveAcademicYearForDate(LocalDate date) {
        List<AcademicYear> all = academicYearRepo.findAll();
        for (AcademicYear ay : all) {
            if (ay.getStartDate() == null || ay.getEndDate() == null) continue;
            if (!date.isBefore(ay.getStartDate()) && !date.isAfter(ay.getEndDate())) {
                return ay.getAcademicYearId();
            }
        }
        return resolveCurrentAcademicYearId();
    }

    /** The tenant's currently-active academic year id — throws with a
     *  clear message when the school hasn't set one, so HR knows to
     *  fix that before using leaves. */
    public String resolveCurrentAcademicYearId() {
        return academicYearRepo.findByIsCurrent(true)
            .map(AcademicYear::getAcademicYearId)
            .orElseThrow(() -> new BusinessException(
                "No current academic year set for this school. "
              + "Ask your admin to mark one on the Academic Years page."));
    }

    /** Loads the full {@link AcademicYear} record — needed when we
     *  need labels or start/end dates for display / summing. */
    public AcademicYear resolveAcademicYearById(String academicYearId) {
        return academicYearRepo.findById(academicYearId)
            .orElseThrow(() -> new BusinessException(
                "Academic year not found: " + academicYearId));
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
