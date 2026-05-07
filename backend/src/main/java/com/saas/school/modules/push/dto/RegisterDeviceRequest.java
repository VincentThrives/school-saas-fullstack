package com.saas.school.modules.push.dto;

/** Body for {@code POST /api/v1/devices/register}. */
public class RegisterDeviceRequest {
    private String token;
    private String platform; // "ANDROID" or "IOS"

    public RegisterDeviceRequest() {}

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
}
