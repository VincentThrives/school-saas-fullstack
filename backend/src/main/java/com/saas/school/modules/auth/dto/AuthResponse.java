package com.saas.school.modules.auth.dto;

import com.saas.school.modules.user.model.UserRole;

import java.util.Map;

public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private UserRole role;
    private Map<String, Boolean> featureFlags;
    private UserDto user;

    public AuthResponse() {
    }

    public AuthResponse(String accessToken, String refreshToken, UserRole role, Map<String, Boolean> featureFlags, UserDto user) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.role = role;
        this.featureFlags = featureFlags;
        this.user = user;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public Map<String, Boolean> getFeatureFlags() {
        return featureFlags;
    }

    public void setFeatureFlags(Map<String, Boolean> featureFlags) {
        this.featureFlags = featureFlags;
    }

    public UserDto getUser() {
        return user;
    }

    public void setUser(UserDto user) {
        this.user = user;
    }
}
