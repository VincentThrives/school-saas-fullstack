package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.LeaveType;

public class LeaveTypeDto {

    private String id;
    private String code;
    private String name;
    private double defaultAnnualQuota;
    private boolean paid;
    private boolean active;
    private int sortOrder;

    public static LeaveTypeDto fromEntity(LeaveType t) {
        LeaveTypeDto d = new LeaveTypeDto();
        d.id = t.getId();
        d.code = t.getCode();
        d.name = t.getName();
        d.defaultAnnualQuota = t.getDefaultAnnualQuota();
        d.paid = t.isPaid();
        d.active = t.isActive();
        d.sortOrder = t.getSortOrder();
        return d;
    }

    public String getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public double getDefaultAnnualQuota() { return defaultAnnualQuota; }
    public boolean isPaid() { return paid; }
    public boolean isActive() { return active; }
    public int getSortOrder() { return sortOrder; }
}
