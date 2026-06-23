package com.saas.school.modules.sms.dto;

import com.saas.school.modules.sms.model.SmsAuditLog;
import com.saas.school.modules.sms.model.SmsTrigger;

import java.time.Instant;

/**
 * Row in the SMS audit log table. Sent to both tenant admins (their
 * own school's history) and Super Admin (cross-tenant view).
 * Phone number is masked for the tenant view via {@link #maskPhone}.
 */
public class SmsAuditLogDto {

    private String id;
    private String tenantId;
    private SmsTrigger trigger;
    private String recipientPhone;
    private String recipientRole;
    private String body;
    private SmsAuditLog.Status status;
    private String errorMessage;
    private double costInr;
    /** Sender header used for this row (e.g. STANNE, SPRING, VTPLS). */
    private String senderId;
    /** DLT template id used. Surfaces in the audit table for diagnosing
     *  template-mismatch rejections from MSG91. */
    private String templateId;
    /** Stored verbatim from SmsAuditLog so the frontend can decide what
     *  the {@link #relatedStudentName} hint means in context — today only
     *  "AttendanceRecord" rows resolve to a student name. */
    private String relatedEntityType;
    /** Display name of the student this SMS was about, when resolvable.
     *  Populated for ABSENCE_ALERT rows (relatedEntityType="AttendanceRecord")
     *  by looking up relatedEntityId in the Students collection. Null for
     *  other triggers, soft-deleted students, or anything we can't resolve. */
    private String relatedStudentName;
    private Instant createdAt;
    private Instant sentAt;
    private Instant deliveredAt;

    public SmsAuditLogDto() {}

    public static SmsAuditLogDto from(SmsAuditLog log, boolean maskPhone) {
        return from(log, maskPhone, java.util.Collections.emptyMap());
    }

    /**
     * Build a DTO with an optional student-name lookup map. Callers that
     * page over audit rows fetch all referenced studentIds in one query
     * and pass the resolved map here — each row becomes O(1).
     */
    public static SmsAuditLogDto from(SmsAuditLog log, boolean maskPhone,
                                      java.util.Map<String, String> studentNamesById) {
        SmsAuditLogDto dto = new SmsAuditLogDto();
        dto.id = log.getId();
        dto.tenantId = log.getTenantId();
        dto.trigger = log.getTrigger();
        dto.recipientPhone = maskPhone ? mask(log.getRecipientPhone()) : log.getRecipientPhone();
        dto.recipientRole = log.getRecipientRole();
        dto.body = log.getBody();
        dto.status = log.getStatus();
        dto.errorMessage = log.getErrorMessage();
        dto.costInr = log.getCostInr();
        dto.senderId = log.getSenderId();
        dto.templateId = log.getTemplateId();
        dto.relatedEntityType = log.getRelatedEntityType();
        // Only resolve when the row's relatedEntity points at a student.
        // Other triggers store different entity types here (Event id, etc.)
        // and the map lookup would silently miss anyway, but the explicit
        // check keeps intent clear and avoids leaking unrelated names later.
        if ("AttendanceRecord".equals(log.getRelatedEntityType())
                && log.getRelatedEntityId() != null
                && studentNamesById != null) {
            dto.relatedStudentName = studentNamesById.get(log.getRelatedEntityId());
        }
        dto.createdAt = log.getCreatedAt();
        dto.sentAt = log.getSentAt();
        dto.deliveredAt = log.getDeliveredAt();
        return dto;
    }

    /** "+919876543210" → "+91 98•••••3210" — enough for the admin
     *  to recognise the recipient without exposing the full number
     *  in a screenshot or shared report. */
    private static String mask(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        int n = phone.length();
        return phone.substring(0, 5) + "•••••" + phone.substring(n - 4);
    }

    // ── Getters / setters ──────────────────────────────────────

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public SmsTrigger getTrigger() { return trigger; }
    public String getRecipientPhone() { return recipientPhone; }
    public String getRecipientRole() { return recipientRole; }
    public String getBody() { return body; }
    public SmsAuditLog.Status getStatus() { return status; }
    public String getErrorMessage() { return errorMessage; }
    public double getCostInr() { return costInr; }
    public String getSenderId() { return senderId; }
    public String getTemplateId() { return templateId; }
    public String getRelatedEntityType() { return relatedEntityType; }
    public String getRelatedStudentName() { return relatedStudentName; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSentAt() { return sentAt; }
    public Instant getDeliveredAt() { return deliveredAt; }
}
