package com.saas.school.modules.featureflag.dto;

public class FeatureToggleRequest {

    private String featureKey;
    private boolean enabled;
    private String reason;

    public String getFeatureKey() { return featureKey; }
    public void setFeatureKey(String featureKey) { this.featureKey = featureKey; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
