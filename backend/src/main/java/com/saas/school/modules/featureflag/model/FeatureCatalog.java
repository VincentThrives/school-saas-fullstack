package com.saas.school.modules.featureflag.model;

import com.saas.school.modules.tenant.model.Tenant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "feature_catalog")
public class FeatureCatalog {
    @Id
    private String featureKey;
    private String displayName;
    private String description;
    private boolean defaultEnabled;
    private List<Tenant.SubscriptionPlan> availableInPlans;

    public FeatureCatalog() {
    }

    public FeatureCatalog(String featureKey, String displayName, String description, boolean defaultEnabled,
                          List<Tenant.SubscriptionPlan> availableInPlans) {
        this.featureKey = featureKey;
        this.displayName = displayName;
        this.description = description;
        this.defaultEnabled = defaultEnabled;
        this.availableInPlans = availableInPlans;
    }

    public String getFeatureKey() { return featureKey; }
    public void setFeatureKey(String featureKey) { this.featureKey = featureKey; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isDefaultEnabled() { return defaultEnabled; }
    public void setDefaultEnabled(boolean defaultEnabled) { this.defaultEnabled = defaultEnabled; }

    public List<Tenant.SubscriptionPlan> getAvailableInPlans() { return availableInPlans; }
    public void setAvailableInPlans(List<Tenant.SubscriptionPlan> availableInPlans) { this.availableInPlans = availableInPlans; }
}
