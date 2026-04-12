package com.saas.school.modules.tenant.repository;

import com.saas.school.modules.tenant.model.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Optional;

public interface TenantRepository extends MongoRepository<Tenant, String> {

    Optional<Tenant> findBySubdomain(String subdomain);
    Optional<Tenant> findByCustomDomain(String customDomain);
    boolean existsBySubdomain(String subdomain);

    @Query("{ 'status': ?0, 'deletedAt': null }")
    Page<Tenant> findByStatusAndNotDeleted(Tenant.TenantStatus status, Pageable pageable);

    @Query("{ 'deletedAt': null }")
    Page<Tenant> findAllActive(Pageable pageable);

    @Query("{ '$or': [{'subdomain': ?0}, {'tenantId': ?0}], 'deletedAt': null }")
    Optional<Tenant> findBySubdomainOrTenantId(String identifier);

    long countByStatus(Tenant.TenantStatus status);
}
