package com.saas.school.modules.sms.dto;

import java.time.Instant;
import java.util.List;

/**
 * Response for {@code POST /api/v1/sms/event-notice}. Mirrors
 * {@link SendHolidayNoticeResponse} so the frontend can reuse the
 * same "Queued to N recipients" confirmation snackbar pattern.
 */
public class SendEventNoticeResponse {
    private List<String> audiences;
    private int recipientCount;
    private Instant queuedAt;

    public SendEventNoticeResponse() {}

    public SendEventNoticeResponse(List<String> audiences, int recipientCount, Instant queuedAt) {
        this.audiences = audiences;
        this.recipientCount = recipientCount;
        this.queuedAt = queuedAt;
    }

    public List<String> getAudiences() { return audiences; }
    public void setAudiences(List<String> audiences) { this.audiences = audiences; }

    public int getRecipientCount() { return recipientCount; }
    public void setRecipientCount(int n) { this.recipientCount = n; }

    public Instant getQueuedAt() { return queuedAt; }
    public void setQueuedAt(Instant at) { this.queuedAt = at; }
}
