package com.saas.school.modules.sms.dto;

/**
 * Body for {@code PUT /api/v1/super/sms/tenants/{tenantId}}.
 *
 * SUPER_ADMIN only. Every field is optional — backend applies only the
 * ones present, so the Super Admin UI can patch one toggle at a time
 * without resending the whole document.
 */
public class UpdateTenantSmsSettingsRequest {

    private Boolean enabled;
    private Boolean absenceAlertEnabled;
    private Boolean resultPublishEnabled;
    private Boolean customNoticeEnabled;
    private Double  monthlyBudgetInr;
    private Boolean notifyAdminOnFailure;

    public UpdateTenantSmsSettingsRequest() {}

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public Boolean getAbsenceAlertEnabled() { return absenceAlertEnabled; }
    public void setAbsenceAlertEnabled(Boolean v) { this.absenceAlertEnabled = v; }

    public Boolean getResultPublishEnabled() { return resultPublishEnabled; }
    public void setResultPublishEnabled(Boolean v) { this.resultPublishEnabled = v; }

    public Boolean getCustomNoticeEnabled() { return customNoticeEnabled; }
    public void setCustomNoticeEnabled(Boolean v) { this.customNoticeEnabled = v; }

    public Double getMonthlyBudgetInr() { return monthlyBudgetInr; }
    public void setMonthlyBudgetInr(Double v) { this.monthlyBudgetInr = v; }

    public Boolean getNotifyAdminOnFailure() { return notifyAdminOnFailure; }
    public void setNotifyAdminOnFailure(Boolean v) { this.notifyAdminOnFailure = v; }
}
