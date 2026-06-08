package com.saas.school.modules.sms.dto;

import com.saas.school.modules.sms.model.TenantSmsSettings;

import java.time.Instant;

/**
 * Read-only projection of {@link TenantSmsSettings} sent to both
 * Super Admin (full data) and School Admin (same shape, no extra fields).
 * Both views read the same data; only mutation is gated by role.
 */
public class TenantSmsSettingsDto {

    private String tenantId;
    private boolean enabled;
    private boolean absenceAlertEnabled;
    private boolean resultPublishEnabled;
    private boolean customNoticeEnabled;
    private boolean holidayNoticeEnabled;
    private double monthlyBudgetInr;
    private double costUsedThisMonth;
    private String costMonth;
    private boolean notifyAdminOnFailure;
    private Instant updatedAt;
    private String updatedBy;

    public TenantSmsSettingsDto() {}

    public static TenantSmsSettingsDto from(TenantSmsSettings s) {
        TenantSmsSettingsDto dto = new TenantSmsSettingsDto();
        dto.tenantId = s.getTenantId();
        dto.enabled = s.isEnabled();
        dto.absenceAlertEnabled = s.isAbsenceAlertEnabled();
        dto.resultPublishEnabled = s.isResultPublishEnabled();
        dto.customNoticeEnabled = s.isCustomNoticeEnabled();
        dto.holidayNoticeEnabled = s.isHolidayNoticeEnabled();
        dto.monthlyBudgetInr = s.getMonthlyBudgetInr();
        dto.costUsedThisMonth = s.getCostUsedThisMonth();
        dto.costMonth = s.getCostMonth();
        dto.notifyAdminOnFailure = s.isNotifyAdminOnFailure();
        dto.updatedAt = s.getUpdatedAt();
        dto.updatedBy = s.getUpdatedBy();
        return dto;
    }

    /** Sensible "all-off" defaults shown when no settings row exists yet. */
    public static TenantSmsSettingsDto defaults(String tenantId) {
        TenantSmsSettingsDto dto = new TenantSmsSettingsDto();
        dto.tenantId = tenantId;
        dto.enabled = false;
        dto.monthlyBudgetInr = 2000.0;
        dto.notifyAdminOnFailure = true;
        return dto;
    }

    // ── Getters / setters ──────────────────────────────────────

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public boolean isAbsenceAlertEnabled() { return absenceAlertEnabled; }
    public void setAbsenceAlertEnabled(boolean v) { this.absenceAlertEnabled = v; }

    public boolean isResultPublishEnabled() { return resultPublishEnabled; }
    public void setResultPublishEnabled(boolean v) { this.resultPublishEnabled = v; }

    public boolean isCustomNoticeEnabled() { return customNoticeEnabled; }
    public void setCustomNoticeEnabled(boolean v) { this.customNoticeEnabled = v; }

    public boolean isHolidayNoticeEnabled() { return holidayNoticeEnabled; }
    public void setHolidayNoticeEnabled(boolean v) { this.holidayNoticeEnabled = v; }

    public double getMonthlyBudgetInr() { return monthlyBudgetInr; }
    public void setMonthlyBudgetInr(double v) { this.monthlyBudgetInr = v; }

    public double getCostUsedThisMonth() { return costUsedThisMonth; }
    public void setCostUsedThisMonth(double v) { this.costUsedThisMonth = v; }

    public String getCostMonth() { return costMonth; }
    public void setCostMonth(String v) { this.costMonth = v; }

    public boolean isNotifyAdminOnFailure() { return notifyAdminOnFailure; }
    public void setNotifyAdminOnFailure(boolean v) { this.notifyAdminOnFailure = v; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
