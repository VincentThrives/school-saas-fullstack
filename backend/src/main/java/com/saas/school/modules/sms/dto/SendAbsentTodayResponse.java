package com.saas.school.modules.sms.dto;

import java.time.Instant;

/**
 * Ack from {@code POST /api/v1/sms/send-absent-today}.
 *
 * <p>Three counts so the admin's snackbar can be specific:</p>
 *
 * <ul>
 *   <li>{@code queued} — students for whom an SMS request was actually
 *       handed to MSG91 in this call</li>
 *   <li>{@code skippedAlreadySent} — students who had a SENT/DELIVERED/PENDING
 *       audit row from earlier today; idempotency-skipped silently</li>
 *   <li>{@code skippedNoPhone} — students with no parent phone on record;
 *       the admin needs to add the phone before next time</li>
 * </ul>
 */
public class SendAbsentTodayResponse {

    private int queued;
    private int skippedAlreadySent;
    private int skippedNoPhone;
    private Instant dispatchedAt;

    public SendAbsentTodayResponse() {}

    public SendAbsentTodayResponse(int queued, int skippedAlreadySent, int skippedNoPhone, Instant dispatchedAt) {
        this.queued = queued;
        this.skippedAlreadySent = skippedAlreadySent;
        this.skippedNoPhone = skippedNoPhone;
        this.dispatchedAt = dispatchedAt;
    }

    public int getQueued() { return queued; }
    public void setQueued(int queued) { this.queued = queued; }

    public int getSkippedAlreadySent() { return skippedAlreadySent; }
    public void setSkippedAlreadySent(int skippedAlreadySent) { this.skippedAlreadySent = skippedAlreadySent; }

    public int getSkippedNoPhone() { return skippedNoPhone; }
    public void setSkippedNoPhone(int skippedNoPhone) { this.skippedNoPhone = skippedNoPhone; }

    public Instant getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(Instant dispatchedAt) { this.dispatchedAt = dispatchedAt; }
}
