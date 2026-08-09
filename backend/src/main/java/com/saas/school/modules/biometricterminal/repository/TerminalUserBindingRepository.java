package com.saas.school.modules.biometricterminal.repository;

import com.saas.school.modules.biometricterminal.model.TerminalUserBinding;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TerminalUserBindingRepository extends MongoRepository<TerminalUserBinding, String> {

    Optional<TerminalUserBinding> findByTerminalSerialAndTerminalUserId(
        String terminalSerial, String terminalUserId);

    List<TerminalUserBinding> findByTerminalSerial(String terminalSerial);

    long countByTerminalSerial(String terminalSerial);

    void deleteByTerminalSerialAndTerminalUserId(String terminalSerial, String terminalUserId);
}
