package com.saas.school.modules.sms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for {@code POST /api/v1/sms/event-notice} — fired from
 * the per-event "Send SMS" action on the school admin's Events page.
 *
 * <p>Maps the three free-text fields to the {@code {#var#}} slots in
 * the school's EVENT_NOTICE DLT template:</p>
 *
 * <pre>
 *   Dear Parent, {eventName} is scheduled on {eventDate} at {eventTime}.
 *   Kindly mark your calendar and plan to attend. - {school name}
 * </pre>
 *
 * <p>{@code eventName} usually carries "Name · Description" so the
 * single var slot can communicate both. {@code eventTime} is a free
 * string ("10:00 AM" or "10am – 12pm").</p>
 *
 * <p>Same {@link SmsAudience} model as holiday-notice — All / Students /
 * Employees / one Class.</p>
 */
public class SendEventNoticeRequest {

    /** One or more audiences — final recipient set is the union of all
     *  picked audiences, deduped by phone in the dispatch pipeline. */
    @NotEmpty(message = "Pick at least one audience")
    private List<SmsAudience> audiences;

    /** Required only when {@link SmsAudience#CLASS} is among the chosen audiences. */
    private String classId;

    /** Event name + optional description, already concatenated by the
     *  frontend (e.g. "Annual Day · Cultural performances"). Lands in
     *  var1 of the DLT template. Kept under 120 to leave room for the
     *  rest of the body inside MSG91's 160-char fragment. */
    @NotBlank(message = "eventName is required")
    @Size(max = 120)
    private String eventName;

    /** Free-form event date. Admin formats it ("9 May 2026"). var2. */
    @NotBlank(message = "eventDate is required")
    @Size(max = 80)
    private String eventDate;

    /** Event time ("10:00 AM" / "10am – 12pm"). var3. */
    @NotBlank(message = "eventTime is required")
    @Size(max = 80)
    private String eventTime;

    /** Optional reference to the source Event doc, audit-only. */
    private String eventId;

    public SendEventNoticeRequest() {}

    public List<SmsAudience> getAudiences() { return audiences; }
    public void setAudiences(List<SmsAudience> audiences) { this.audiences = audiences; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }

    public String getEventDate() { return eventDate; }
    public void setEventDate(String eventDate) { this.eventDate = eventDate; }

    public String getEventTime() { return eventTime; }
    public void setEventTime(String eventTime) { this.eventTime = eventTime; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
}
