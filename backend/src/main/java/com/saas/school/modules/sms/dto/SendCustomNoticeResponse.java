package com.saas.school.modules.sms.dto;

import java.time.Instant;
import java.util.List;

/**
 * Lightweight ack returned from {@code POST /api/v1/sms/custom-notice}.
 *
 * <p>{@code recipientCount} reflects the number of unique userIds we
 * actually queued after unioning the picked audiences and dropping
 * duplicates. Phone-level dedupe still happens later in the dispatch
 * pipeline, so the eventual SENT count in the audit log may be slightly
 * lower (e.g. when one parent is linked to two children in different
 * audience buckets).</p>
 */
public class SendCustomNoticeResponse {

    private List<String> audiences;
    private int recipientCount;
    private Instant dispatchedAt;

    public SendCustomNoticeResponse() {}

    public SendCustomNoticeResponse(List<String> audiences, int recipientCount, Instant dispatchedAt) {
        this.audiences = audiences;
        this.recipientCount = recipientCount;
        this.dispatchedAt = dispatchedAt;
    }

    public List<String> getAudiences() { return audiences; }
    public void setAudiences(List<String> audiences) { this.audiences = audiences; }

    public int getRecipientCount() { return recipientCount; }
    public void setRecipientCount(int recipientCount) { this.recipientCount = recipientCount; }

    public Instant getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(Instant dispatchedAt) { this.dispatchedAt = dispatchedAt; }
}
