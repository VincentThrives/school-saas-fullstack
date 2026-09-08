package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.LeaveBalance;

public class LeaveBalanceDto {

    private String leaveTypeCode;
    private String leaveTypeName;
    private double allocated;
    private double carryForwardIn;
    private double used;
    private double remaining;
    /** True when this row's type is currently active (visible in the
     *  Apply Leave dropdown). Inactive types still surface in the
     *  balance sheet for transparency but are read-only. */
    private boolean typeActive;

    public static LeaveBalanceDto fromEntity(LeaveBalance b, String leaveTypeName, boolean typeActive) {
        LeaveBalanceDto d = new LeaveBalanceDto();
        d.leaveTypeCode = b.getLeaveTypeCode();
        d.leaveTypeName = leaveTypeName;
        d.allocated = b.getAllocated();
        d.carryForwardIn = b.getCarryForwardIn();
        d.used = b.getUsed();
        d.remaining = b.getRemaining();
        d.typeActive = typeActive;
        return d;
    }

    public String getLeaveTypeCode() { return leaveTypeCode; }
    public String getLeaveTypeName() { return leaveTypeName; }
    public double getAllocated() { return allocated; }
    public double getCarryForwardIn() { return carryForwardIn; }
    public double getUsed() { return used; }
    public double getRemaining() { return remaining; }
    public boolean isTypeActive() { return typeActive; }
}
