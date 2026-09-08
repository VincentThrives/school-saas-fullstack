package com.saas.school.modules.hr.dto;

/** Payload for creating or updating a {@link com.saas.school.modules.hr.model.LeaveType}.
 *  Code is required on create; ignored on update (immutable). */
public class UpsertLeaveTypeRequest {
    private String code;
    private String name;
    private Double defaultAnnualQuota;
    private Boolean paid;
    private Boolean active;
    private Integer sortOrder;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Double getDefaultAnnualQuota() { return defaultAnnualQuota; }
    public void setDefaultAnnualQuota(Double defaultAnnualQuota) { this.defaultAnnualQuota = defaultAnnualQuota; }

    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
