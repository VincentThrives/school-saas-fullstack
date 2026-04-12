package com.saas.school.modules.featureflag.dto;

import java.util.Map;

public class BulkFeatureToggleRequest {

    private Map<String, Boolean> features;
    private String reason;

    public Map<String, Boolean> getFeatures() { return features; }
    public void setFeatures(Map<String, Boolean> features) { this.features = features; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
