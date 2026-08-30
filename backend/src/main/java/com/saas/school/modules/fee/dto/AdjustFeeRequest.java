package com.saas.school.modules.fee.dto;

import jakarta.validation.constraints.PositiveOrZero;

/**
 * Payload for the per-student "Adjust Fee" dialog. Admin sets a
 * surcharge (extra charge over the class default — mid-year admission,
 * late-payment penalty, custom uniform), a concession (discount —
 * scholarship, sibling, hardship), or both, each with a dropdown-sourced
 * reason. Backend recomputes {@code totalDue = totalFee + surcharge −
 * concession} and logs an audit correction on the ledger.
 */
public class AdjustFeeRequest {

    @PositiveOrZero(message = "surcharge must be zero or positive")
    private double surcharge;

    /** Frozen at save time — the dropdown label as picked. Null when
     *  {@link #surcharge} is 0 (no surcharge → no reason). */
    private String surchargeReason;

    @PositiveOrZero(message = "concession must be zero or positive")
    private double concession;

    /** Frozen at save time. Null when {@link #concession} is 0. */
    private String concessionReason;

    public AdjustFeeRequest() {}

    public double getSurcharge() { return surcharge; }
    public void setSurcharge(double surcharge) { this.surcharge = surcharge; }

    public String getSurchargeReason() { return surchargeReason; }
    public void setSurchargeReason(String surchargeReason) { this.surchargeReason = surchargeReason; }

    public double getConcession() { return concession; }
    public void setConcession(double concession) { this.concession = concession; }

    public String getConcessionReason() { return concessionReason; }
    public void setConcessionReason(String concessionReason) { this.concessionReason = concessionReason; }
}
