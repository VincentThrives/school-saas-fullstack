package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class UpdateTerminalRequest {

    @NotBlank
    @Size(max = 80)
    private String label;

    public UpdateTerminalRequest() {}

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
