package com.saas.school.modules.biometric.repository;

import com.saas.school.modules.biometric.model.ScannerPairingCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ScannerPairingCodeRepository extends MongoRepository<ScannerPairingCode, String> {

    Optional<ScannerPairingCode> findByCodeHash(String codeHash);
}
