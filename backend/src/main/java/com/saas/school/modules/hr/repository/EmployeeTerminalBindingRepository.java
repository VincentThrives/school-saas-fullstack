package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.EmployeeTerminalBinding;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface EmployeeTerminalBindingRepository
        extends MongoRepository<EmployeeTerminalBinding, String> {

    /** Fast path for the ADMS resolver — hits the unique compound
     *  index directly. */
    Optional<EmployeeTerminalBinding> findByTerminalSerialAndTerminalUserId(
        String terminalSerial, String terminalUserId);

    /** Per-terminal listing for the HR bindings page. */
    List<EmployeeTerminalBinding> findByTerminalSerial(String terminalSerial);

    /** Global — used to show "employees not enrolled anywhere" so HR
     *  can spot who still needs a device enrolment. */
    List<EmployeeTerminalBinding> findAllByOrderByBoundAtDesc();

    long countByTerminalSerial(String terminalSerial);
}
