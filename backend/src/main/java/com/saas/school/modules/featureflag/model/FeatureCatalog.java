package com.saas.school.modules.featureflag.model;

import com.saas.school.modules.tenant.model.Tenant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "feature_catalog")
public class FeatureCatalog {
    @Id
    private String featureKey;
    private String displayName;
    private String description;
    private boolean defaultEnabled;
    private List<Tenant.SubscriptionPlan> availableInPlans;
}
