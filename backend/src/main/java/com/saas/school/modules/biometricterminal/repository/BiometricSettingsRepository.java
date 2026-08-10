package com.saas.school.modules.biometricterminal.repository;

import com.saas.school.modules.biometricterminal.model.BiometricSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BiometricSettingsRepository extends MongoRepository<BiometricSettings, String> {
}
