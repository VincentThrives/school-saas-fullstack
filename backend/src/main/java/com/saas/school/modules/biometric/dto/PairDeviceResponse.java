package com.saas.school.modules.biometric.dto;

/** What the tablet gets back after successful pairing. Stores the
 *  token in Capacitor Preferences / IndexedDB, ships it as
 *  {@code X-Device-Token} on every subsequent request. */
public class PairDeviceResponse {
    private String deviceToken;
    private String deviceId;
    private String deviceLabel;
    private String tenantId;
    private String tenantName;
    /** School code / subdomain — the tablet sends this back as the
     *  {@code X-School-Code} header on every subsequent request so
     *  the device-auth filter can resolve the tenant DB. */
    private String schoolCode;

    public PairDeviceResponse() {}

    public PairDeviceResponse(String deviceToken, String deviceId, String deviceLabel,
                              String tenantId, String tenantName, String schoolCode) {
        this.deviceToken = deviceToken;
        this.deviceId = deviceId;
        this.deviceLabel = deviceLabel;
        this.tenantId = tenantId;
        this.tenantName = tenantName;
        this.schoolCode = schoolCode;
    }

    public String getDeviceToken() { return deviceToken; }
    public void setDeviceToken(String deviceToken) { this.deviceToken = deviceToken; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getSchoolCode() { return schoolCode; }
    public void setSchoolCode(String schoolCode) { this.schoolCode = schoolCode; }
}
