package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.LeaveType;

import java.util.List;

public class LeaveTypeDto {

    private String id;
    private String code;
    private String name;
    private String description;
    private String color;

    private double defaultAnnualQuota;
    private boolean paid;
    private boolean active;
    private int sortOrder;

    private boolean carryForward;
    private double carryForwardMax;
    private String accrualType;

    private int minAdvanceDays;
    private int maxConsecutiveDays;
    private int requiresAttachmentAfterDays;
    private String applicableGender;
    private double mandatoryPerYear;

    /** Per-employment-category policy overrides. Null / empty on
     *  legacy types → top-level fields apply to everyone (same as
     *  before per-category rules landed). */
    private List<LeaveType.CategoryPolicy> policies;

    public static LeaveTypeDto fromEntity(LeaveType t) {
        LeaveTypeDto d = new LeaveTypeDto();
        d.id = t.getId();
        d.code = t.getCode();
        d.name = t.getName();
        d.description = t.getDescription();
        d.color = t.getColor();
        d.defaultAnnualQuota = t.getDefaultAnnualQuota();
        d.paid = t.isPaid();
        d.active = t.isActive();
        d.sortOrder = t.getSortOrder();
        d.carryForward = t.isCarryForward();
        d.carryForwardMax = t.getCarryForwardMax();
        d.accrualType = t.getAccrualType();
        d.minAdvanceDays = t.getMinAdvanceDays();
        d.maxConsecutiveDays = t.getMaxConsecutiveDays();
        d.requiresAttachmentAfterDays = t.getRequiresAttachmentAfterDays();
        d.applicableGender = t.getApplicableGender();
        d.mandatoryPerYear = t.getMandatoryPerYear();
        d.policies = t.getPolicies();
        return d;
    }

    public String getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getColor() { return color; }
    public double getDefaultAnnualQuota() { return defaultAnnualQuota; }
    public boolean isPaid() { return paid; }
    public boolean isActive() { return active; }
    public int getSortOrder() { return sortOrder; }
    public boolean isCarryForward() { return carryForward; }
    public double getCarryForwardMax() { return carryForwardMax; }
    public String getAccrualType() { return accrualType; }
    public int getMinAdvanceDays() { return minAdvanceDays; }
    public int getMaxConsecutiveDays() { return maxConsecutiveDays; }
    public int getRequiresAttachmentAfterDays() { return requiresAttachmentAfterDays; }
    public String getApplicableGender() { return applicableGender; }
    public double getMandatoryPerYear() { return mandatoryPerYear; }
    public List<LeaveType.CategoryPolicy> getPolicies() { return policies; }
}
