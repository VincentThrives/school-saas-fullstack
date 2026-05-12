package com.saas.school.modules.sms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for {@code POST /api/v1/sms/custom-notice} — the
 * school-admin "broadcast" endpoint.
 *
 * <p>The admin picks one or more audiences via checkboxes and types a
 * message. The backend resolves each audience to a list of userIds,
 * unions them, dedupes by phone downstream, then fans out via
 * {@link com.saas.school.modules.sms.service.SmsService#dispatchAsync}.</p>
 *
 * <p>Multi-select means the admin can do e.g. "all teachers + parents
 * of class 5A" in one click without two separate sends. {@code ALL}
 * checked alongside others is a no-op since {@code ALL} already covers
 * them — the union is harmless and the per-phone dedupe in
 * {@code resolveRecipients} guarantees each parent gets only one SMS.</p>
 *
 * <p><b>Message length</b> — capped at 300 chars to keep us inside the
 * DLT-approved template body (1 var × max ~300 chars + the brand suffix
 * MSG91 will append at the template level). Anything longer would risk
 * MSG91 rejecting the send for "variable exceeds template length".</p>
 */
public class SendCustomNoticeRequest {

    public enum Audience {
        /** All non-deleted users with a usable phone — parents + employees. */
        ALL,
        /** Parents of every active student. Falls back to the student's
         *  own User record when no parent is linked. */
        ALL_STUDENTS,
        /** Teachers, principal and school admins. */
        ALL_EMPLOYEES,
        /** Parents of students in one specific class — {@link #classId}
         *  must be set when this audience is in the list. */
        CLASS
    }

    /** One or more audiences. Final recipient set is the union of all
     *  the lists each audience resolves to, deduped by phone in the
     *  dispatch pipeline. */
    @NotEmpty(message = "Pick at least one audience")
    private List<Audience> audiences;

    /** Required only when {@link Audience#CLASS} is among the chosen audiences. */
    private String classId;

    @NotBlank(message = "message is required")
    @Size(max = 300, message = "message must be 300 characters or fewer")
    private String message;

    public SendCustomNoticeRequest() {}

    public List<Audience> getAudiences() { return audiences; }
    public void setAudiences(List<Audience> audiences) { this.audiences = audiences; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
