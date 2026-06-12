package com.saas.school.modules.sms.dto;

import java.time.Instant;

/**
 * Response for {@code POST /api/v1/sms/result-notice}. Reports back the
 * recipient + scope counts so the snackbar can say:
 *   "Queued 47 SMS · 12 students had no parent phone · across 3 sections"
 * </p>
 */
public class SendResultNoticeResponse {

    /** Total SMS queued — sum of every per-student dispatch across all
     *  target sections. Includes parents reached via Student.parentPhone
     *  AND via linked Parent User accounts (deduped by phone). */
    private int recipientCount;

    /** How many students had at least one SMS path (parentPhone or
     *  parentIds). The difference between {@code studentsCovered} and
     *  the total student count is shown as {@code skippedNoPhone}. */
    private int studentsCovered;

    /** Students skipped because they had neither parentPhone nor any
     *  resolvable parentIds. Admin should clean those records before
     *  re-running. */
    private int skippedNoPhone;

    /** How many (classId, sectionId) targets were processed — echoes the
     *  multi-pick size so the UI can confirm scope ("Published for 3 sections"). */
    private int sectionsCovered;

    /** When the dispatch was queued (not when delivered — see audit log). */
    private Instant queuedAt;

    public SendResultNoticeResponse() {}

    public SendResultNoticeResponse(int recipientCount, int studentsCovered,
                                    int skippedNoPhone, int sectionsCovered,
                                    Instant queuedAt) {
        this.recipientCount = recipientCount;
        this.studentsCovered = studentsCovered;
        this.skippedNoPhone = skippedNoPhone;
        this.sectionsCovered = sectionsCovered;
        this.queuedAt = queuedAt;
    }

    public int getRecipientCount() { return recipientCount; }
    public void setRecipientCount(int recipientCount) { this.recipientCount = recipientCount; }

    public int getStudentsCovered() { return studentsCovered; }
    public void setStudentsCovered(int studentsCovered) { this.studentsCovered = studentsCovered; }

    public int getSkippedNoPhone() { return skippedNoPhone; }
    public void setSkippedNoPhone(int skippedNoPhone) { this.skippedNoPhone = skippedNoPhone; }

    public int getSectionsCovered() { return sectionsCovered; }
    public void setSectionsCovered(int sectionsCovered) { this.sectionsCovered = sectionsCovered; }

    public Instant getQueuedAt() { return queuedAt; }
    public void setQueuedAt(Instant queuedAt) { this.queuedAt = queuedAt; }
}
