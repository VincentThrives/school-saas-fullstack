package com.saas.school.modules.biometricterminal.repository;

import com.saas.school.modules.biometricterminal.model.ScannerTerminal;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ScannerTerminalRepository extends MongoRepository<ScannerTerminal, String> {

    Optional<ScannerTerminal> findByTerminalSerial(String terminalSerial);
    List<ScannerTerminal> findAllByOrderByCreatedAtDesc();
    boolean existsByTerminalSerial(String terminalSerial);
}
