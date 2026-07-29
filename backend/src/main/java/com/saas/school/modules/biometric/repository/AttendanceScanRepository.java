package com.saas.school.modules.biometric.repository;

import com.saas.school.modules.biometric.model.AttendanceScan;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceScanRepository extends MongoRepository<AttendanceScan, String> {

    Optional<AttendanceScan> findByTenantIdAndStudentIdAndScanDateKey(
            String tenantId, String studentId, String scanDateKey);

    List<AttendanceScan> findTop100ByTenantIdOrderByScannedAtDesc(String tenantId);

    List<AttendanceScan> findByTenantIdAndScanDateKeyOrderByScannedAtDesc(
            String tenantId, String scanDateKey);
}
