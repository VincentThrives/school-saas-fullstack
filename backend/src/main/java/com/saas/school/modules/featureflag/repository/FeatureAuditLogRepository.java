package com.saas.school.modules.featureflag.repository;

import com.saas.school.modules.featureflag.model.FeatureAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface FeatureAuditLogRepository extends MongoRepository<FeatureAuditLog, String> {

    Page<FeatureAuditLog> findByTenantIdOrderByTimestampDesc(String tenantId, Pageable pageable);

    Page<FeatureAuditLog> findByTenantIdAndFeatureKeyOrderByTimestampDesc(String tenantId, String featureKey, Pageable pageable);

    List<FeatureAuditLog> findByTenantIdAndTimestampAfterAndUndoneIsFalse(String tenantId, Instant after);
}
