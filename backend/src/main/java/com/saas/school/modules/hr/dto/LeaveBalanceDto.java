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
    /** Effective accrual pattern for this row — comes from the
     *  per-category policy when a policy is provided; falls back to
     *  the top-level LeaveType default otherwise. */
    private String accrualType;
    /** Effective annual quota for this row — same resolution as
     *  {@link #accrualType}. Lets the UI render "5 of 12 credited so
     *  far" for MONTHLY types without a second round-trip. */
    private double annualQuota;
    /** How many "monthly slices" (0..{@link #accrualTotalUnits}) of
     *  the annual quota have been credited into {@link #allocated}
     *  so far this year. YEARLY types report the AY month count;
     *  MONTHLY / QUARTERLY grow over time as the accrual job ticks. */
    private int accruedUnits;
    /** Total accrual slices for this academic year — equal to the
     *  AY's month count (10 for Jun–Mar, 12 for Apr–Mar / Jul–Jun).
     *  Sent so the UI can render "5 of 10 credited" without having
     *  to know how the tenant's AY is set up. */
    private int accrualTotalUnits;

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
        return fromEntity(b, t, null, 12);
    }

    /**
     * Same as {@link #fromEntity(LeaveBalance, LeaveType)} but takes
     * an already-resolved per-category policy so accrual + quota fields
     * reflect the employee's own category rather than the top-level
     * defaults, and the AY's total month count so the UI can render
     * "5 of 10 credited" for a 10-month academic year.
     * Callers that know the employee (My Leave, HR Balances) should
     * use this overload so a Contract employee sees their own 6-day
     * monthly quota, not the type's headline 12-day figure.
     */
    public static LeaveBalanceDto fromEntity(LeaveBalance b, LeaveType t,
                                              LeaveType.CategoryPolicy policy,
                                              int ayMonthCount) {
        LeaveBalanceDto d = new LeaveBalanceDto();
        d.leaveTypeCode = b.getLeaveTypeCode();
        d.leaveTypeName = t != null ? t.getName() : b.getLeaveTypeCode();
        d.color = t != null ? t.getColor() : null;
        d.paid = t != null && t.isPaid();
        if (policy != null) {
            d.accrualType = policy.getAccrualType();
            d.annualQuota = policy.getAnnualQuota();
        } else if (t != null) {
            d.accrualType = t.getAccrualType();
            d.annualQuota = t.getDefaultAnnualQuota();
        } else {
            d.accrualType = "YEARLY";
        }
        d.accruedUnits = b.getAccruedUnits();
        d.accrualTotalUnits = Math.max(1, ayMonthCount);
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
    public double getAnnualQuota() { return annualQuota; }
    public int getAccruedUnits() { return accruedUnits; }
    public int getAccrualTotalUnits() { return accrualTotalUnits; }
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
