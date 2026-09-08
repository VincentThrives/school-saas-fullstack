package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.LeaveApplication;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Enriched read model for the HR queue and the employee history
 * list. Adds {@code employeeName}, {@code designation}, and
 * {@code leaveTypeName} to the raw entity so callers don't need a
 * second round-trip.
 */
public class LeaveApplicationDto {

    private String id;
    private String employeeId;
    private String employeeName;
    private String designation;

    private String leaveTypeCode;
    private String leaveTypeName;

    private LocalDate startDate;
    private LocalDate endDate;
    private boolean startHalf;
    private boolean endHalf;
    private double days;

    private String reason;
    private String status;

    private String reviewedByUserId;
    private Instant reviewedAt;
    private String reviewNotes;

    private String submittedByUserId;
    private Instant requestedAt;
    private Instant cancelledAt;

    public static LeaveApplicationDto fromEntity(
            LeaveApplication row, String employeeName, String designation, String leaveTypeName) {
        LeaveApplicationDto d = new LeaveApplicationDto();
        d.id = row.getId();
        d.employeeId = row.getEmployeeId();
        d.employeeName = employeeName;
        d.designation = designation;
        d.leaveTypeCode = row.getLeaveTypeCode();
        d.leaveTypeName = leaveTypeName;
        d.startDate = row.getStartDate();
        d.endDate = row.getEndDate();
        d.startHalf = row.isStartHalf();
        d.endHalf = row.isEndHalf();
        d.days = row.getDays();
        d.reason = row.getReason();
        d.status = row.getStatus() != null ? row.getStatus().name() : null;
        d.reviewedByUserId = row.getReviewedByUserId();
        d.reviewedAt = row.getReviewedAt();
        d.reviewNotes = row.getReviewNotes();
        d.submittedByUserId = row.getSubmittedByUserId();
        d.requestedAt = row.getRequestedAt();
        d.cancelledAt = row.getCancelledAt();
        return d;
    }

    public String getId() { return id; }
    public String getEmployeeId() { return employeeId; }
    public String getEmployeeName() { return employeeName; }
    public String getDesignation() { return designation; }
    public String getLeaveTypeCode() { return leaveTypeCode; }
    public String getLeaveTypeName() { return leaveTypeName; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public boolean isStartHalf() { return startHalf; }
    public boolean isEndHalf() { return endHalf; }
    public double getDays() { return days; }
    public String getReason() { return reason; }
    public String getStatus() { return status; }
    public String getReviewedByUserId() { return reviewedByUserId; }
    public Instant getReviewedAt() { return reviewedAt; }
    public String getReviewNotes() { return reviewNotes; }
    public String getSubmittedByUserId() { return submittedByUserId; }
    public Instant getRequestedAt() { return requestedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
}
