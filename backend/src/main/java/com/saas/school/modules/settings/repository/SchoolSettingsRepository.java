package com.saas.school.modules.settings.repository;
import com.saas.school.modules.settings.model.SchoolSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
public interface SchoolSettingsRepository extends MongoRepository<SchoolSettings, String> {
    Optional<SchoolSettings> findByTenantId(String tenantId);
}