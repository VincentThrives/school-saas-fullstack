package com.saas.school.modules.featureflag.repository;

import com.saas.school.modules.featureflag.model.FeatureTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FeatureTemplateRepository extends MongoRepository<FeatureTemplate, String> {
}
