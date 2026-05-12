package com.saas.school.modules.user.dto;

/**
 * Feature flags scoped to the current user's tenant. Lives inside
 * {@link UserDto} on the {@code /users/me} response so the frontend
 * can gate UI without a separate roundtrip on every page.
 *
 * Currently only SMS; will grow as more tenant-gated features ship.
 */
public class TenantFeaturesDto {

    /** Master switch — false means hide every SMS reference in the UI. */
    private boolean smsEnabled;

    /** Per-trigger toggles. All default to false. */
    private boolean smsAbsenceAlertEnabled;
    private boolean smsResultPublishEnabled;
    private boolean smsCustomNoticeEnabled;

    public TenantFeaturesDto() {}

    public TenantFeaturesDto(boolean smsEnabled,
                             boolean smsAbsenceAlertEnabled,
                             boolean smsResultPublishEnabled,
                             boolean smsCustomNoticeEnabled) {
        this.smsEnabled = smsEnabled;
        this.smsAbsenceAlertEnabled = smsAbsenceAlertEnabled;
        this.smsResultPublishEnabled = smsResultPublishEnabled;
        this.smsCustomNoticeEnabled = smsCustomNoticeEnabled;
    }

    public boolean isSmsEnabled() { return smsEnabled; }
    public void setSmsEnabled(boolean v) { this.smsEnabled = v; }

    public boolean isSmsAbsenceAlertEnabled() { return smsAbsenceAlertEnabled; }
    public void setSmsAbsenceAlertEnabled(boolean v) { this.smsAbsenceAlertEnabled = v; }

    public boolean isSmsResultPublishEnabled() { return smsResultPublishEnabled; }
    public void setSmsResultPublishEnabled(boolean v) { this.smsResultPublishEnabled = v; }

    public boolean isSmsCustomNoticeEnabled() { return smsCustomNoticeEnabled; }
    public void setSmsCustomNoticeEnabled(boolean v) { this.smsCustomNoticeEnabled = v; }
}
