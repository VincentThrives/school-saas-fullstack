package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployeeAttendanceSettingsRepository extends MongoRepository<EmployeeAttendanceSettings, String> {

    Optional<EmployeeAttendanceSettings> findByTenantId(String tenantId);
}
