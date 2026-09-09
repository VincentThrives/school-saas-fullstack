package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.LeaveBalance;
import com.saas.school.modules.hr.model.LeaveType;

/**
 * Enriched balance row — combines the persisted numbers with the
 * type-level policy fields the UI needs to render context (color,
 * paid flag, mandatory threshold, carry-forward config). Callers
 * don't need to join type + balance client-side.
 */
public class LeaveBalanceDto {

    private String leaveTypeCode;
    private String leaveTypeName;
    private String color;
    private boolean paid;
    private String accrualType;

    // Balance numbers.
    private double allocated;
    private double carryForwardIn;
    private double used;
    private double remaining;

    // Compulsory-quota tracking.
    private double mandatoryPerYear;
    private double mandatoryUsed;

    // Carry-forward policy — surfaced so the UI can hint at what will
    // happen at year-end without a second round-trip.
    private boolean carryForwardEnabled;
    private double carryForwardMax;

    /** True when this row's type is currently active (visible in the
     *  Apply Leave dropdown). Inactive types still surface in the
     *  balance sheet for transparency but are read-only. */
    private boolean typeActive;

    public static LeaveBalanceDto fromEntity(LeaveBalance b, LeaveType t) {
        LeaveBalanceDto d = new LeaveBalanceDto();
        d.leaveTypeCode = b.getLeaveTypeCode();
        d.leaveTypeName = t != null ? t.getName() : b.getLeaveTypeCode();
        d.color = t != null ? t.getColor() : null;
        d.paid = t != null && t.isPaid();
        d.accrualType = t != null ? t.getAccrualType() : "YEARLY";
        d.allocated = b.getAllocated();
        d.carryForwardIn = b.getCarryForwardIn();
        d.used = b.getUsed();
        d.remaining = b.getRemaining();
        d.mandatoryPerYear = t != null ? t.getMandatoryPerYear() : 0;
        d.mandatoryUsed = b.getMandatoryUsed();
        d.carryForwardEnabled = t != null && t.isCarryForward();
        d.carryForwardMax = t != null ? t.getCarryForwardMax() : 0;
        d.typeActive = t != null && t.isActive();
        return d;
    }

    public String getLeaveTypeCode() { return leaveTypeCode; }
    public String getLeaveTypeName() { return leaveTypeName; }
    public String getColor() { return color; }
    public boolean isPaid() { return paid; }
    public String getAccrualType() { return accrualType; }
    public double getAllocated() { return allocated; }
    public double getCarryForwardIn() { return carryForwardIn; }
    public double getUsed() { return used; }
    public double getRemaining() { return remaining; }
    public double getMandatoryPerYear() { return mandatoryPerYear; }
    public double getMandatoryUsed() { return mandatoryUsed; }
    public boolean isCarryForwardEnabled() { return carryForwardEnabled; }
    public double getCarryForwardMax() { return carryForwardMax; }
    public boolean isTypeActive() { return typeActive; }
}
