package com.saas.school.modules.fee.dto;

import com.saas.school.modules.fee.model.StudentFeeLedger;

import java.time.LocalDate;

/**
 * Edits a single payment entry. The existing entry is marked as superseded
 * (not deleted); a new entry is appended with the corrected values. This
 * keeps a full audit trail.
 */
public class UpdatePaymentRequest {
    private double amount;
    private StudentFeeLedger.PaymentMode mode;
    private LocalDate paidAt;
    private String notes;
    private String reason;

    public UpdatePaymentRequest() {}

    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }

    public StudentFeeLedger.PaymentMode getMode() { return mode; }
    public void setMode(StudentFeeLedger.PaymentMode mode) { this.mode = mode; }

    public LocalDate getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDate paidAt) { this.paidAt = paidAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
