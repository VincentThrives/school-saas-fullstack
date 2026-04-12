package com.saas.school.modules.featureflag.dto;

import java.util.Map;

public class CreateTemplateRequest {

    private String name;
    private String description;
    private Map<String, Boolean> featureFlags;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Map<String, Boolean> getFeatureFlags() { return featureFlags; }
    public void setFeatureFlags(Map<String, Boolean> featureFlags) { this.featureFlags = featureFlags; }
}
