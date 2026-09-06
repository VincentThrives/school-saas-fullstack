package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.RegularizationRequest;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Enriched response row for the Approvals queue + employee's "My
 * requests" list. Adds the employee's display name + designation so
 * HR can identify the requester at a glance without a client-side
 * lookup.
 */
public class RegularizationRequestDto {

    private String id;
    private String employeeId;
    private String employeeName;
    private String designation;

    private LocalDate date;
    private Instant claimedInTime;
    private Instant claimedOutTime;
    private String reason;

    private String status;

    private String reviewedByUserId;
    private Instant reviewedAt;
    private String reviewNotes;

    private Instant requestedAt;

    public RegularizationRequestDto() {}

    public static RegularizationRequestDto fromEntity(RegularizationRequest r,
                                                      String employeeName,
                                                      String designation) {
        RegularizationRequestDto dto = new RegularizationRequestDto();
        dto.id = r.getId();
        dto.employeeId = r.getEmployeeId();
        dto.employeeName = employeeName;
        dto.designation = designation;
        dto.date = r.getDate();
        dto.claimedInTime = r.getClaimedInTime();
        dto.claimedOutTime = r.getClaimedOutTime();
        dto.reason = r.getReason();
        dto.status = r.getStatus() == null ? null : r.getStatus().name();
        dto.reviewedByUserId = r.getReviewedByUserId();
        dto.reviewedAt = r.getReviewedAt();
        dto.reviewNotes = r.getReviewNotes();
        dto.requestedAt = r.getRequestedAt();
        return dto;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Instant getClaimedInTime() { return claimedInTime; }
    public void setClaimedInTime(Instant claimedInTime) { this.claimedInTime = claimedInTime; }

    public Instant getClaimedOutTime() { return claimedOutTime; }
    public void setClaimedOutTime(Instant claimedOutTime) { this.claimedOutTime = claimedOutTime; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getReviewedByUserId() { return reviewedByUserId; }
    public void setReviewedByUserId(String reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }

    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }

    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
}
