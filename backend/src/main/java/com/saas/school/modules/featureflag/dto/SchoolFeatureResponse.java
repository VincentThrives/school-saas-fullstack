package com.saas.school.modules.featureflag.dto;

import java.util.List;
import java.util.Map;

public class SchoolFeatureResponse {

    private String tenantId;
    private String schoolName;
    private String plan;
    private int totalFeatures;
    private int enabledFeatures;
    private List<FeatureDetail> features;
    private Map<String, List<FeatureDetail>> categories;

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }

    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }

    public int getTotalFeatures() { return totalFeatures; }
    public void setTotalFeatures(int totalFeatures) { this.totalFeatures = totalFeatures; }

    public int getEnabledFeatures() { return enabledFeatures; }
    public void setEnabledFeatures(int enabledFeatures) { this.enabledFeatures = enabledFeatures; }

    public List<FeatureDetail> getFeatures() { return features; }
    public void setFeatures(List<FeatureDetail> features) { this.features = features; }

    public Map<String, List<FeatureDetail>> getCategories() { return categories; }
    public void setCategories(Map<String, List<FeatureDetail>> categories) { this.categories = categories; }

    public static class FeatureDetail {

        private String featureKey;
        private String displayName;
        private String description;
        private String category;
        private boolean enabled;
        private boolean coreFeature;
        private boolean availableInPlan;

        public String getFeatureKey() { return featureKey; }
        public void setFeatureKey(String featureKey) { this.featureKey = featureKey; }

        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }

        public boolean isCoreFeature() { return coreFeature; }
        public void setCoreFeature(boolean coreFeature) { this.coreFeature = coreFeature; }

        public boolean isAvailableInPlan() { return availableInPlan; }
        public void setAvailableInPlan(boolean availableInPlan) { this.availableInPlan = availableInPlan; }
    }
}
