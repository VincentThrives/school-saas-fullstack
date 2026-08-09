package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class BindUserRequest {

    /** Terminal-side identifier ("PIN" / enrolment slot). Kept as a String
     *  because different terminal firmwares serialise it as numeric or as
     *  a padded string — we don't parse it, just store it verbatim. */
    @NotBlank
    @Size(max = 32)
    private String terminalUserId;

    @NotBlank
    private String studentId;

    public BindUserRequest() {}

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
}
