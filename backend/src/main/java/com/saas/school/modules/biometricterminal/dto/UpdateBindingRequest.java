package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for PUT /api/v1/biometric/terminals/{serial}/bindings/{terminalUserId}
 *  — swap the terminal-side enrolment slot number on an existing binding. */
public class UpdateBindingRequest {

    @NotBlank
    private String terminalUserId;

    public UpdateBindingRequest() {}

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }
}
