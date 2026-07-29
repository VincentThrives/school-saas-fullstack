package com.saas.school.modules.biometric.repository;

import com.saas.school.modules.biometric.model.ScannerDevice;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ScannerDeviceRepository extends MongoRepository<ScannerDevice, String> {

    Optional<ScannerDevice> findByDeviceTokenHash(String deviceTokenHash);

    List<ScannerDevice> findByTenantIdAndRevokedAtIsNullOrderByPairedAtDesc(String tenantId);
}
