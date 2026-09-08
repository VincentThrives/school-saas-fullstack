package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Employee-submitted leave request. Modeled on
 * {@link RegularizationRequest} — same PENDING → APPROVED / REJECTED
 * lifecycle, same review fields, same HR-facing surface.
 *
 * <p>Key difference: a leave spans a date RANGE, not a single day.
 * On approval, {@code LeaveService} writes one {@link EmployeeAttendance}
 * row per date in [startDate, endDate] with status="ON_LEAVE" and
 * source="LEAVE" so downstream reads (calendar, report, auto-OUT
 * skip) light up automatically without needing to know about the
 * leave table.</p>
 *
 * <p>Half-day support: {@code startHalf} and {@code endHalf} let an
 * employee take an afternoon-off on their first day and morning-off
 * on their last day (or same-day half-day when start == end). Half-
 * days on either boundary contribute 0.5 to {@code days} instead of
 * 1.0. Full-only days (all middle days + non-half boundaries)
 * contribute 1.0 each. {@code days} is computed at submit time and
 * stored so downstream summaries don't need the settings + calendar
 * loop.</p>
 *
 * <p>For half-day leaves we DO still write an attendance row — with
 * status="ON_LEAVE" — because the alternative (leaving the row blank
 * and expecting a real punch to fill in the "other half") loses the
 * audit trail. If schools later need to record BOTH a partial
 * present-punch and a half-day leave on the same date, we'll extend
 * the row schema; today's UX doesn't demand it.</p>
 *
 * <p>Cancellation: employees can cancel their own PENDING leaves
 * unconditionally, and APPROVED leaves whose {@code startDate} is
 * still in the future. On cancel of an APPROVED leave we delete the
 * generated attendance rows (looked up by
 * markedByUserId = "leave:{id}") and refund the balance.</p>
 */
@Document(collection = "leave_applications")
@CompoundIndexes({
    // HR Approvals queue view — tenant + status ordered by requestedAt.
    @CompoundIndex(name = "tenant_status_requested",
        def = "{'tenantId':1,'status':1,'requestedAt':-1}"),
    // Overlap check — "does this employee already have a non-rejected
    // leave overlapping any date in the new range?". Range overlap is
    // enforced in the service (Mongo doesn't do range-vs-range in a
    // single index), but this composite makes the driving query fast.
    @CompoundIndex(name = "employee_start_end",
        def = "{'employeeId':1,'startDate':1,'endDate':1}")
})
public class LeaveApplication {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    /** Teacher.teacherId of the requester. */
    private String employeeId;

    /** Uppercase code matching {@link LeaveType#getCode()}. Kept as a
     *  string (not id) so a name-only edit of the type doesn't require
     *  rewriting historical applications. */
    private String leaveTypeCode;

    /** Inclusive range endpoints — [startDate, endDate]. Single-day
     *  leaves have {@code startDate == endDate}. */
    private LocalDate startDate;
    private LocalDate endDate;

    /** Half-day on the first date — 2nd half of that day off. Ignored
     *  when start != end AND the employee wants a full first day; UI
     *  hides the toggle for that case. */
    private boolean startHalf;

    /** Half-day on the last date — 1st half of that day off. Ignored
     *  when start != end AND the employee wants a full last day. On
     *  single-day requests (start == end), only startHalf is used and
     *  endHalf is ignored to prevent "half + half = zero" confusion. */
    private boolean endHalf;

    /** Computed at submit — total leave days requested. Full = 1,
     *  half = 0.5. Stored so balance reads don't need to re-derive
     *  from the date range every time. */
    private double days;

    /** Employee's justification. Required; HR sees it verbatim. */
    private String reason;

    private Status status;

    /** userId of the reviewer (HR admin). Absent on PENDING and on
     *  cancelled rows. */
    private String reviewedByUserId;
    private Instant reviewedAt;
    private String reviewNotes;

    /** userId of the submitter — usually the employee themselves. */
    private String submittedByUserId;
    @CreatedDate
    private Instant requestedAt;

    /** Set when the employee cancels — either PENDING → CANCELLED or
     *  APPROVED-in-future → CANCELLED. Retained on the row for the
     *  history view (rather than a hard delete) so employees see
     *  their own cancellations. */
    private Instant cancelledAt;

    public LeaveApplication() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getLeaveTypeCode() { return leaveTypeCode; }
    public void setLeaveTypeCode(String leaveTypeCode) { this.leaveTypeCode = leaveTypeCode; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public boolean isStartHalf() { return startHalf; }
    public void setStartHalf(boolean startHalf) { this.startHalf = startHalf; }

    public boolean isEndHalf() { return endHalf; }
    public void setEndHalf(boolean endHalf) { this.endHalf = endHalf; }

    public double getDays() { return days; }
    public void setDays(double days) { this.days = days; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getReviewedByUserId() { return reviewedByUserId; }
    public void setReviewedByUserId(String reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }

    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }

    public String getSubmittedByUserId() { return submittedByUserId; }
    public void setSubmittedByUserId(String submittedByUserId) { this.submittedByUserId = submittedByUserId; }

    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }

    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }

    public enum Status {
        PENDING, APPROVED, REJECTED, CANCELLED
    }
}
