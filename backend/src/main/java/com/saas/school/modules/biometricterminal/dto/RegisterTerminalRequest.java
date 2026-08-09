package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterTerminalRequest {

    @NotBlank
    @Size(max = 64)
    private String serial;

    @NotBlank
    @Size(max = 80)
    private String label;

    public RegisterTerminalRequest() {}

    public String getSerial() { return serial; }
    public void setSerial(String serial) { this.serial = serial; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
