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
    private Instant createdAt;
    private Instant sentAt;
    private Instant deliveredAt;

    public SmsAuditLogDto() {}

    public static SmsAuditLogDto from(SmsAuditLog log, boolean maskPhone) {
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
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSentAt() { return sentAt; }
    public Instant getDeliveredAt() { return deliveredAt; }
}
