package com.saas.school.modules.biometric.dto;

/** Request body for {@code PUT /biometric/settings}. */
public class BiometricSettingsRequest {
    private boolean cardEnabled;
    private boolean faceEnabled;
    private String lateCutoff;
    private String openTime;
    private Double faceThreshold;

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
}
