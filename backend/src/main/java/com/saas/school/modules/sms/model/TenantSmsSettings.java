package com.saas.school.modules.sms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SMS configuration for a single tenant (one document per school).
 *
 * Created lazily — if a tenant has no settings document yet, the
 * defaults (everything OFF) are used. The Super Admin panel inserts
 * a row only when they actually toggle something on for that tenant.
 *
 * Why per-tenant instead of a JWT claim or env var:
 *   - Super Admin can change it without redeploying
 *   - Per-tenant budget caps need somewhere to live
 *   - Audit trail of who toggled what
 *   - Cost-used counter resets monthly
 *
 * Authorization: only SUPER_ADMIN can mutate. School admins get a
 * read-only view via {@link com.saas.school.modules.sms.controller.SmsController}.
 */
@Document(collection = "tenant_sms_settings")
public class TenantSmsSettings {

    @Id
    private String id;

    /** Unique tenant identifier — also the Mongo database routing key. */
    @Indexed(unique = true)
    private String tenantId;

    /** Master switch — if false, NO SMS is sent for this tenant, period.
     *  Super Admin controls this. Default false (opt-in). */
    private boolean enabled;

    /** Per-trigger toggles, all default to false. Allows e.g. "absence
     *  alerts ON but result publish OFF" for cost-conscious schools.
     *  Each one is the row-level "active" checkbox in the SMS Control
     *  table — independent of whether a template is configured. */
    private boolean absenceAlertEnabled;
    private boolean resultPublishEnabled;
    private boolean customNoticeEnabled;
    private boolean holidayNoticeEnabled;
    private boolean eventNoticeEnabled;

    /** Hard cap (₹) per calendar month. SMS stops sending once
     *  costUsedThisMonth >= monthlyBudgetInr. Resets on the 1st of
     *  each month via the scheduled reset job. Default 2000. */
    private double monthlyBudgetInr = 2000.0;

    /** Running total of estimated SMS cost (₹) this month. Updated
     *  on every successful send. Compared against monthlyBudgetInr
     *  by SmsService before sending. */
    private double costUsedThisMonth;

    /** ISO year-month (e.g. "2026-05") last reset was for. When this
     *  is not the current month, costUsedThisMonth is rolled to zero
     *  before the next budget check. Cheaper than a separate cron. */
    private String costMonth;

    /** Email school admin when SMS fails (e.g. budget hit, MSG91 down). */
    private boolean notifyAdminOnFailure = true;

    /**
     * Per-trigger DLT template configuration. Key = SmsTrigger.name().
     * Each value carries the templateId, sender header, and approved
     * body the Super Admin pasted for this tenant on the SMS Control
     * page's expanded row. Empty / missing entries mean "no template
     * configured" — the dispatch pipeline writes a SKIPPED audit row
     * and the SMS doesn't fire.
     *
     * <p>No platform fallback exists anywhere: a sender like VTPLS is
     * just another header value the operator might paste; it's not
     * special.</p>
     */
    private Map<String, SmsTemplate> templates = new HashMap<>();

    /** Audit metadata. */
    private Instant createdAt;
    private Instant updatedAt;
    private String updatedBy; // userId of the Super Admin who last toggled

    public TenantSmsSettings() {}

    public TenantSmsSettings(String tenantId) {
        this.tenantId = tenantId;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    /** Helper used by SmsService for the 3rd of its 4 layered checks. */
    public boolean isTriggerEnabled(SmsTrigger trigger) {
        return switch (trigger) {
            case ABSENCE_ALERT     -> absenceAlertEnabled;
            case RESULT_COMBINED, RESULT_SINGLE -> resultPublishEnabled;
            case CUSTOM_NOTICE     -> customNoticeEnabled;
            case HOLIDAY_NOTICE    -> holidayNoticeEnabled;
            case EVENT_NOTICE      -> eventNoticeEnabled;
        };
    }

    /** Returns the tenant's stored template for a trigger, or null
     *  if Super Admin hasn't configured one. Caller (the resolver in
     *  SmsService) treats null as "skip — no template". */
    public SmsTemplate templateFor(SmsTrigger trigger) {
        if (templates == null) return null;
        return templates.get(trigger.name());
    }

    // ── Getters / setters ──────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

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

    public boolean isEventNoticeEnabled() { return eventNoticeEnabled; }
    public void setEventNoticeEnabled(boolean v) { this.eventNoticeEnabled = v; }

    public double getMonthlyBudgetInr() { return monthlyBudgetInr; }
    public void setMonthlyBudgetInr(double v) { this.monthlyBudgetInr = v; }

    public double getCostUsedThisMonth() { return costUsedThisMonth; }
    public void setCostUsedThisMonth(double v) { this.costUsedThisMonth = v; }

    public String getCostMonth() { return costMonth; }
    public void setCostMonth(String v) { this.costMonth = v; }

    public boolean isNotifyAdminOnFailure() { return notifyAdminOnFailure; }
    public void setNotifyAdminOnFailure(boolean v) { this.notifyAdminOnFailure = v; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Map<String, SmsTemplate> getTemplates() {
        return templates == null ? (templates = new HashMap<>()) : templates;
    }
    public void setTemplates(Map<String, SmsTemplate> templates) {
        this.templates = templates == null ? new HashMap<>() : templates;
    }

    /**
     * One DLT-registered template stored on a tenant's settings.
     *
     * <p>{@code body} is the EXACT text the school's DLT entry was
     * approved with — stored only for the audit-log preview and so
     * the operator can see what got pasted. MSG91 sends from
     * {@code templateId} alone; the body never goes over the wire.
     * {@code varLabels} drive the form hints ("Student name", "Class &amp;
     * section", "Marks summary") next to each {@code {#var#}} slot.</p>
     */
    public static class SmsTemplate {
        private String templateId;
        private String senderId;
        private String body;
        private List<String> varLabels = new ArrayList<>();

        public SmsTemplate() {}

        /** True iff this template has both DLT ids — required to send. */
        public boolean isResolvable() {
            return templateId != null && !templateId.isBlank()
                    && senderId  != null && !senderId.isBlank();
        }

        public String getTemplateId() { return templateId; }
        public void setTemplateId(String v) { this.templateId = v; }
        public String getSenderId() { return senderId; }
        public void setSenderId(String v) { this.senderId = v; }
        public String getBody() { return body; }
        public void setBody(String v) { this.body = v; }
        public List<String> getVarLabels() { return varLabels; }
        public void setVarLabels(List<String> v) { this.varLabels = v == null ? new ArrayList<>() : v; }
    }
}
