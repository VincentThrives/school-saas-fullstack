package com.saas.school.modules.biometric.dto;

/** Request body for {@code PUT /biometric/settings}. */
public class BiometricSettingsRequest {
    private boolean cardEnabled;
    private boolean faceEnabled;
    private String lateCutoff;
    private String openTime;
    private Double faceThreshold;
    private Double matchMargin;

    /** OFF | AUTO | MANUAL — see BiometricSettings.exitTracking. */
    private String exitTracking;
    private String earliestExitTime;
    private Boolean notifyOnEntry;
    private Boolean notifyOnExit;
    private Boolean notifyOnEarlyLeave;

    public boolean isCardEnabled() { return cardEnabled; }
    public void setCardEnabled(boolean cardEnabled) { this.cardEnabled = cardEnabled; }

    public boolean isFaceEnabled() { return faceEnabled; }
    public void setFaceEnabled(boolean faceEnabled) { this.faceEnabled = faceEnabled; }

    public String getLateCutoff() { return lateCutoff; }
    public void setLateCutoff(String lateCutoff) { this.lateCutoff = lateCutoff; }

    public String getOpenTime() { return openTime; }
    public void setOpenTime(String openTime) { this.openTime = openTime; }

    public Double getFaceThreshold() { return faceThreshold; }
    public void setFaceThreshold(Double faceThreshold) { this.faceThreshold = faceThreshold; }

    public Double getMatchMargin() { return matchMargin; }
    public void setMatchMargin(Double matchMargin) { this.matchMargin = matchMargin; }

    public String getExitTracking() { return exitTracking; }
    public void setExitTracking(String exitTracking) { this.exitTracking = exitTracking; }

    public String getEarliestExitTime() { return earliestExitTime; }
    public void setEarliestExitTime(String earliestExitTime) { this.earliestExitTime = earliestExitTime; }

    public Boolean getNotifyOnEntry() { return notifyOnEntry; }
    public void setNotifyOnEntry(Boolean notifyOnEntry) { this.notifyOnEntry = notifyOnEntry; }

    public Boolean getNotifyOnExit() { return notifyOnExit; }
    public void setNotifyOnExit(Boolean notifyOnExit) { this.notifyOnExit = notifyOnExit; }

    public Boolean getNotifyOnEarlyLeave() { return notifyOnEarlyLeave; }
    public void setNotifyOnEarlyLeave(Boolean notifyOnEarlyLeave) { this.notifyOnEarlyLeave = notifyOnEarlyLeave; }
}
