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
 * Employee-submitted request to fix a missing or incomplete
 * attendance row. The request captures what the employee CLAIMS
 * their IN / OUT times were; approval (auto or manual) writes the
 * claim onto {@link EmployeeAttendance} with source=REGULARIZATION.
 *
 * <p>Lifecycle:</p>
 * <ul>
 *   <li>{@link Status#PENDING} — waiting for HR review</li>
 *   <li>{@link Status#AUTO_APPROVED} — passed the auto-approve
 *       window rule (settings.regularizationAutoApproveWindowMinutes)
 *       so it landed as approved without hitting the HR queue</li>
 *   <li>{@link Status#APPROVED} — HR approved</li>
 *   <li>{@link Status#REJECTED} — HR rejected with a note</li>
 * </ul>
 *
 * <p>Backdate + monthly cap enforcement lives in
 * {@code RegularizationService.submit}, not on the model.</p>
 */
@Document(collection = "regularization_requests")
@CompoundIndexes({
    // Queue view — HR's Approvals page filters by tenant + status,
    // orders by requestedAt.
    @CompoundIndex(name = "tenant_status_requested",
        def = "{'tenantId':1,'status':1,'requestedAt':-1}"),
    // Monthly-cap check — count APPROVED + PENDING per employee per
    // calendar month before letting a new submission through.
    @CompoundIndex(name = "employee_date",
        def = "{'employeeId':1,'date':1}")
})
public class RegularizationRequest {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    /** Teacher.teacherId of the requester. */
    private String employeeId;
    /** The date whose attendance is being regularized. */
    private LocalDate date;

    /** What the employee claims their arrival was — nullable if the
     *  request is only fixing a missing OUT. */
    private Instant claimedInTime;
    /** What the employee claims their departure was — nullable if
     *  the request is only fixing a missing IN. */
    private Instant claimedOutTime;

    /** Employee's justification. Free text; HR sees it verbatim on
     *  the Approvals queue. */
    private String reason;

    private Status status;

    /** userId of the reviewer (HR admin). Absent on PENDING and
     *  AUTO_APPROVED rows. */
    private String reviewedByUserId;
    private Instant reviewedAt;
    private String reviewNotes;

    /** userId of the submitter — usually the employee themselves,
     *  but HR could POST on their behalf in a future flow. */
    private String submittedByUserId;
    @CreatedDate
    private Instant requestedAt;

    public RegularizationRequest() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Instant getClaimedInTime() { return claimedInTime; }
    public void setClaimedInTime(Instant claimedInTime) { this.claimedInTime = claimedInTime; }

    public Instant getClaimedOutTime() { return claimedOutTime; }
    public void setClaimedOutTime(Instant claimedOutTime) { this.claimedOutTime = claimedOutTime; }

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

    public enum Status {
        PENDING, AUTO_APPROVED, APPROVED, REJECTED
    }
}
