package com.saas.school.modules.biometric.dto;

/** Public endpoint payload sent by the tablet — the six-digit code
 *  the admin generated moments ago. */
public class PairDeviceRequest {
    private String code;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
