package com.saas.school.modules.biometric.dto;

import java.time.Instant;

/** What the admin's Kiosk Devices page gets back when they click
 *  "Pair new device." The plaintext code is only ever shown here and
 *  on the tablet — never stored anywhere in cleartext. */
public class PairingCodeResponse {
    private String code;         // 6 digits
    private Instant expiresAt;
    private String deviceLabel;

    public PairingCodeResponse() {}

    public PairingCodeResponse(String code, Instant expiresAt, String deviceLabel) {
        this.code = code;
        this.expiresAt = expiresAt;
        this.deviceLabel = deviceLabel;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }
}
