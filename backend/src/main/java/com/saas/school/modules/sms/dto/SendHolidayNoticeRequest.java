package com.saas.school.modules.sms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for {@code POST /api/v1/sms/holiday-notice} — the
 * school admin's "announce a closure" broadcast.
 *
 * <p>Maps the three free-text fields to the {@code {#var#}} slots in
 * the school's HOLIDAY_NOTICE DLT template:</p>
 *
 * <pre>
 *   Dear Parent, school will remain closed on {closureDate} due to
 *   {reason}. Classes Opens on {reopenDate}. - {school name}
 * </pre>
 *
 * <p>Same {@link SmsAudience} model as custom-notice — All / Students /
 * Employees / one Class.</p>
 */
public class SendHolidayNoticeRequest {

    /** One or more audiences — final recipient set is the union of all
     *  picked audiences, deduped by phone in the dispatch pipeline. */
    @NotEmpty(message = "Pick at least one audience")
    private List<SmsAudience> audiences;

    /** Required only when {@link SmsAudience#CLASS} is among the chosen audiences. */
    private String classId;

    /** Free-form closure date. Kept as a plain string so the admin
     *  controls what gets printed ("9 May 2026", "Monday 9 May", "9-11 May"). */
    @NotBlank(message = "closureDate is required")
    @Size(max = 80)
    private String closureDate;

    @NotBlank(message = "reason is required")
    @Size(max = 120)
    private String reason;

    @NotBlank(message = "reopenDate is required")
    @Size(max = 80)
    private String reopenDate;

    public SendHolidayNoticeRequest() {}

    public List<SmsAudience> getAudiences() { return audiences; }
    public void setAudiences(List<SmsAudience> audiences) { this.audiences = audiences; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClosureDate() { return closureDate; }
    public void setClosureDate(String closureDate) { this.closureDate = closureDate; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getReopenDate() { return reopenDate; }
    public void setReopenDate(String reopenDate) { this.reopenDate = reopenDate; }
}
