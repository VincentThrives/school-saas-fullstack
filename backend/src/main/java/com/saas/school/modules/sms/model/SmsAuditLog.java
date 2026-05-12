package com.saas.school.modules.sms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * One row per SMS dispatch attempt. Written BEFORE the MSG91 call
 * (status=PENDING), then updated after the response (SENT/FAILED).
 * MSG91 may later POST a delivery webhook updating status to DELIVERED.
 *
 * Used for:
 *   - per-tenant audit log shown to school admins
 *   - platform-wide audit log for super admin
 *   - cost accounting (sum of costInr per tenant per month)
 *   - debugging delivery failures
 *
 * Tenant-isolated via TenantMongoDbFactory — these documents live in
 * the per-tenant database. The {@code tenantId} field is stored
 * defensively in case we ever need to cross-tenant query.
 */
@Document(collection = "sms_audit_logs")
public class SmsAuditLog {

    public enum Status {
        /** Saved to DB, not yet sent to MSG91. */
        PENDING,
        /** MSG91 accepted the message (returned a messageId). */
        SENT,
        /** MSG91 confirmed delivery to handset via webhook. */
        DELIVERED,
        /** MSG91 rejected, or delivery failed. See errorMessage. */
        FAILED,
        /** Skipped — tenant has SMS disabled, trigger disabled, or budget exhausted. */
        SKIPPED
    }

    @Id
    private String id;

    @Indexed
    private String tenantId;

    /** Who/what caused the SMS — userId for admin-driven, "SYSTEM" for auto-rules. */
    private String triggeredBy;

    /** Trigger enum name — ABSENCE_ALERT, RESULT_COMBINED, etc. */
    @Indexed
    private SmsTrigger trigger;

    /** DLT template ID used for this send. Useful when templates rotate. */
    private String templateId;

    /** Final recipient phone in E.164 (+91XXXXXXXXXX). */
    private String recipientPhone;

    /** Recipient User._id at time of send (may be null if external phone). */
    private String recipientUserId;

    /** PARENT / STUDENT / TEACHER — for filtering in the audit UI. */
    private String recipientRole;

    /** Variable values rendered into the template — kept for forensic replay. */
    private Map<String, String> variables;

    /** The fully-rendered body (for audit / dispute resolution). */
    private String body;

    /** MSG91's messageId — null until SENT. Used to correlate with webhook callbacks. */
    private String msg91MessageId;

    @Indexed
    private Status status;

    /** Populated when status = FAILED. */
    private String errorMessage;

    /** Domain entity this SMS relates to (e.g. AttendanceRecord, Exam) — for traceability. */
    private String relatedEntityType;
    private String relatedEntityId;

    /** Estimated cost in INR. Used to enforce per-tenant budget caps. */
    private double costInr;

    @Indexed(direction = org.springframework.data.mongodb.core.index.IndexDirection.DESCENDING)
    private Instant createdAt;

    private Instant sentAt;
    private Instant deliveredAt;

    public SmsAuditLog() {}

    // ── Getters / setters ──────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTriggeredBy() { return triggeredBy; }
    public void setTriggeredBy(String triggeredBy) { this.triggeredBy = triggeredBy; }

    public SmsTrigger getTrigger() { return trigger; }
    public void setTrigger(SmsTrigger trigger) { this.trigger = trigger; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public String getRecipientPhone() { return recipientPhone; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }

    public String getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(String recipientUserId) { this.recipientUserId = recipientUserId; }

    public String getRecipientRole() { return recipientRole; }
    public void setRecipientRole(String recipientRole) { this.recipientRole = recipientRole; }

    public Map<String, String> getVariables() { return variables; }
    public void setVariables(Map<String, String> variables) { this.variables = variables; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getMsg91MessageId() { return msg91MessageId; }
    public void setMsg91MessageId(String msg91MessageId) { this.msg91MessageId = msg91MessageId; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getRelatedEntityType() { return relatedEntityType; }
    public void setRelatedEntityType(String relatedEntityType) { this.relatedEntityType = relatedEntityType; }

    public String getRelatedEntityId() { return relatedEntityId; }
    public void setRelatedEntityId(String relatedEntityId) { this.relatedEntityId = relatedEntityId; }

    public double getCostInr() { return costInr; }
    public void setCostInr(double costInr) { this.costInr = costInr; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }

    public Instant getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(Instant deliveredAt) { this.deliveredAt = deliveredAt; }
}
