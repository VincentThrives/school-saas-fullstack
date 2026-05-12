package com.saas.school.modules.sms.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Body for {@code POST /api/v1/sms/send-absent-today}.
 *
 * <p>The frontend posts the studentIds the admin ticked in the picker.
 * The backend dedupes against existing audit-log entries for today, looks
 * up each student's parent phone, and fires one SMS per resolved phone.
 * Students already sent today are silently skipped (idempotent).</p>
 */
public class SendAbsentTodayRequest {

    @NotEmpty(message = "Pick at least one student")
    private List<String> studentIds;

    public SendAbsentTodayRequest() {}

    public List<String> getStudentIds() { return studentIds; }
    public void setStudentIds(List<String> studentIds) { this.studentIds = studentIds; }
}
