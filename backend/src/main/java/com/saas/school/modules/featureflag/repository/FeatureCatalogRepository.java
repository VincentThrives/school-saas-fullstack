package com.saas.school.modules.featureflag.repository;

import com.saas.school.modules.featureflag.model.FeatureCatalog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface FeatureCatalogRepository extends MongoRepository<FeatureCatalog, String> {
    Optional<FeatureCatalog> findByFeatureKey(String featureKey);
}
