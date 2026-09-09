package com.saas.school.modules.hr.dto;

/**
 * HR-side payload for overriding an employee's allocation on a
 * specific (type, year). Every field boxed so a partial patch
 * (e.g., "just tweak allocated") is expressible.
 */
public class OverrideBalanceRequest {
    private Double allocated;
    private Double carryForwardIn;
    /** Set to reconcile the used counter after a manual correction —
     *  rarely needed but useful for cleanup. */
    private Double used;

    public Double getAllocated() { return allocated; }
    public void setAllocated(Double allocated) { this.allocated = allocated; }

    public Double getCarryForwardIn() { return carryForwardIn; }
    public void setCarryForwardIn(Double carryForwardIn) { this.carryForwardIn = carryForwardIn; }

    public Double getUsed() { return used; }
    public void setUsed(Double used) { this.used = used; }
}
