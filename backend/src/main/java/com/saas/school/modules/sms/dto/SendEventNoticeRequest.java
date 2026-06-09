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
 *   Dear Parent, {eventName} is scheduled on {eventDate} at {venue}.
 *   - {school name}
 * </pre>
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

    /** Event name. Kept short — DLT templates count toward 160-char SMS
     *  fragments and the venue / date take up room too. */
    @NotBlank(message = "eventName is required")
    @Size(max = 80)
    private String eventName;

    /** Free-form event date. Admin formats it ("9 May 2026 · 10am"). */
    @NotBlank(message = "eventDate is required")
    @Size(max = 80)
    private String eventDate;

    /** Venue or short description ("School Auditorium"). */
    @NotBlank(message = "venue is required")
    @Size(max = 120)
    private String venue;

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

    public String getVenue() { return venue; }
    public void setVenue(String venue) { this.venue = venue; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
}
