package com.saas.school.modules.featureflag.repository;

import com.saas.school.modules.featureflag.model.FeatureCatalog;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FeatureCatalogRepository extends MongoRepository<FeatureCatalog, String> {}
