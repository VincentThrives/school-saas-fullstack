package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class BiometricSettingsDto {

    /** HH:mm 24h. Scans at or before this time on IN direction count as
     *  PRESENT; after it → LATE. */
    @NotBlank
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "lateCutoff must be HH:mm")
    private String lateCutoff;

    /** HH:mm 24h. OUT scans at or after this time count as PRESENT;
     *  before it → EARLY_LEAVE. */
    @NotBlank
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "earliestExitTime must be HH:mm")
    private String earliestExitTime;

    private boolean notifyOnEntry = true;
    private boolean notifyOnExit = false;
    private boolean notifyOnEarlyLeave = true;

    public BiometricSettingsDto() {}

    public String getLateCutoff() { return lateCutoff; }
    public void setLateCutoff(String lateCutoff) { this.lateCutoff = lateCutoff; }

    public String getEarliestExitTime() { return earliestExitTime; }
    public void setEarliestExitTime(String earliestExitTime) { this.earliestExitTime = earliestExitTime; }

    public boolean isNotifyOnEntry() { return notifyOnEntry; }
    public void setNotifyOnEntry(boolean notifyOnEntry) { this.notifyOnEntry = notifyOnEntry; }

    public boolean isNotifyOnExit() { return notifyOnExit; }
    public void setNotifyOnExit(boolean notifyOnExit) { this.notifyOnExit = notifyOnExit; }

    public boolean isNotifyOnEarlyLeave() { return notifyOnEarlyLeave; }
    public void setNotifyOnEarlyLeave(boolean notifyOnEarlyLeave) { this.notifyOnEarlyLeave = notifyOnEarlyLeave; }
}
