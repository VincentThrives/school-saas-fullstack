package com.saas.school.modules.hr.dto;

/** Payload for creating or updating a {@link com.saas.school.modules.hr.model.LeaveType}.
 *  Code is required on create; ignored on update (immutable).
 *
 *  <p>Every field is a boxed type so PATCH-style partial updates work
 *  cleanly — a null field means "don't touch". The service normalises
 *  code to uppercase and applies sensible defaults where useful.</p>
 */
public class UpsertLeaveTypeRequest {
    private String code;
    private String name;
    private String description;
    private String color;

    private Double defaultAnnualQuota;
    private Boolean paid;
    private Boolean active;
    private Integer sortOrder;

    private Boolean carryForward;
    private Double carryForwardMax;
    /** YEARLY / MONTHLY / QUARTERLY */
    private String accrualType;

    private Integer minAdvanceDays;
    private Integer maxConsecutiveDays;
    private Integer requiresAttachmentAfterDays;
    /** ANY / MALE / FEMALE */
    private String applicableGender;
    private Double mandatoryPerYear;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public Double getDefaultAnnualQuota() { return defaultAnnualQuota; }
    public void setDefaultAnnualQuota(Double defaultAnnualQuota) { this.defaultAnnualQuota = defaultAnnualQuota; }

    public Boolean getPaid() { return paid; }
    public void setPaid(Boolean paid) { this.paid = paid; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Boolean getCarryForward() { return carryForward; }
    public void setCarryForward(Boolean carryForward) { this.carryForward = carryForward; }

    public Double getCarryForwardMax() { return carryForwardMax; }
    public void setCarryForwardMax(Double carryForwardMax) { this.carryForwardMax = carryForwardMax; }

    public String getAccrualType() { return accrualType; }
    public void setAccrualType(String accrualType) { this.accrualType = accrualType; }

    public Integer getMinAdvanceDays() { return minAdvanceDays; }
    public void setMinAdvanceDays(Integer minAdvanceDays) { this.minAdvanceDays = minAdvanceDays; }

    public Integer getMaxConsecutiveDays() { return maxConsecutiveDays; }
    public void setMaxConsecutiveDays(Integer maxConsecutiveDays) { this.maxConsecutiveDays = maxConsecutiveDays; }

    public Integer getRequiresAttachmentAfterDays() { return requiresAttachmentAfterDays; }
    public void setRequiresAttachmentAfterDays(Integer requiresAttachmentAfterDays) {
        this.requiresAttachmentAfterDays = requiresAttachmentAfterDays;
    }

    public String getApplicableGender() { return applicableGender; }
    public void setApplicableGender(String applicableGender) { this.applicableGender = applicableGender; }

    public Double getMandatoryPerYear() { return mandatoryPerYear; }
    public void setMandatoryPerYear(Double mandatoryPerYear) { this.mandatoryPerYear = mandatoryPerYear; }
}
