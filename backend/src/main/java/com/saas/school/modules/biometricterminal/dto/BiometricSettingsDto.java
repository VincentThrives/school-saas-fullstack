package com.saas.school.modules.biometricterminal.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class BiometricSettingsDto {

    /** HH:mm 24h. Scans at or before this time on IN direction count as
     *  PRESENT; after it → LATE. */
    @NotBlank
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "lateCutoff must be HH:mm")
    private String lateCutoff;

    /** HH:mm 24h. Scans at or after this time are treated as EXIT
     *  (departure). Before this time = ENTRY (arrival). Replaces the
     *  device's IN/OUT byte for direction inference. */
    @NotBlank
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "earliestExitTime must be HH:mm")
    private String earliestExitTime;

    /** 1 = entry only (parents get 1 SMS/day). 2 = entry + exit
     *  (parents get up to 2 SMS/day). Extra scans past this quota
     *  are silently dropped. */
    @Min(value = 1, message = "expectedScansPerDay must be at least 1")
    @Max(value = 2, message = "expectedScansPerDay must be at most 2")
    private int expectedScansPerDay = 2;

    /** HH:mm 24h. When {@link #absentAutoMarkEnabled} is true, a
     *  scheduled job at this time auto-marks students with no arrival
     *  scan as ABSENT and fires an in-app notification to parents. */
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "absentAutoMarkTime must be HH:mm")
    private String absentAutoMarkTime = "10:30";

    /** Opt-in per tenant. Off by default — enables the auto-absent job. */
    private boolean absentAutoMarkEnabled = false;

    private boolean notifyOnEntry = true;
    private boolean notifyOnExit = false;
    private boolean notifyOnEarlyLeave = true;

    public BiometricSettingsDto() {}

    public String getLateCutoff() { return lateCutoff; }
    public void setLateCutoff(String lateCutoff) { this.lateCutoff = lateCutoff; }

    public String getEarliestExitTime() { return earliestExitTime; }
    public void setEarliestExitTime(String earliestExitTime) { this.earliestExitTime = earliestExitTime; }

    public int getExpectedScansPerDay() { return expectedScansPerDay; }
    public void setExpectedScansPerDay(int expectedScansPerDay) { this.expectedScansPerDay = expectedScansPerDay; }

    public String getAbsentAutoMarkTime() { return absentAutoMarkTime; }
    public void setAbsentAutoMarkTime(String absentAutoMarkTime) { this.absentAutoMarkTime = absentAutoMarkTime; }

    public boolean isAbsentAutoMarkEnabled() { return absentAutoMarkEnabled; }
    public void setAbsentAutoMarkEnabled(boolean absentAutoMarkEnabled) { this.absentAutoMarkEnabled = absentAutoMarkEnabled; }

    public boolean isNotifyOnEntry() { return notifyOnEntry; }
    public void setNotifyOnEntry(boolean notifyOnEntry) { this.notifyOnEntry = notifyOnEntry; }

    public boolean isNotifyOnExit() { return notifyOnExit; }
    public void setNotifyOnExit(boolean notifyOnExit) { this.notifyOnExit = notifyOnExit; }

    public boolean isNotifyOnEarlyLeave() { return notifyOnEarlyLeave; }
    public void setNotifyOnEarlyLeave(boolean notifyOnEarlyLeave) { this.notifyOnEarlyLeave = notifyOnEarlyLeave; }
}
