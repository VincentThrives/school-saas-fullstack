package com.saas.school.modules.hr.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Payload from an employee submitting a regularization request. At
 * least one of claimedInTime / claimedOutTime must be set — the
 * service rejects a request that fills in neither. Date is required
 * and can't be older than
 * {@code settings.regularizationMaxBackdateDays}.
 */
public class SubmitRegularizationRequest {

    private LocalDate date;
    private Instant claimedInTime;
    private Instant claimedOutTime;
    private String reason;

    public SubmitRegularizationRequest() {}

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Instant getClaimedInTime() { return claimedInTime; }
    public void setClaimedInTime(Instant claimedInTime) { this.claimedInTime = claimedInTime; }

    public Instant getClaimedOutTime() { return claimedOutTime; }
    public void setClaimedOutTime(Instant claimedOutTime) { this.claimedOutTime = claimedOutTime; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
