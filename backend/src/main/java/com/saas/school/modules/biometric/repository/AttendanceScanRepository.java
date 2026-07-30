package com.saas.school.modules.biometric.repository;

import com.saas.school.modules.biometric.model.AttendanceScan;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceScanRepository extends MongoRepository<AttendanceScan, String> {

    Optional<AttendanceScan> findByTenantIdAndStudentIdAndScanDateKey(
            String tenantId, String studentId, String scanDateKey);

    /** Lookup for a specific direction — used by the punch-in/out
     *  scan flow to check "has this student already scanned IN
     *  today?" before writing another. */
    Optional<AttendanceScan> findByTenantIdAndStudentIdAndScanDateKeyAndDirection(
            String tenantId, String studentId, String scanDateKey,
            AttendanceScan.Direction direction);

    /** All of a student's scans for a given day (IN and OUT if both). */
    List<AttendanceScan> findByTenantIdAndStudentIdAndScanDateKeyOrderByScannedAtAsc(
            String tenantId, String studentId, String scanDateKey);

    List<AttendanceScan> findTop100ByTenantIdOrderByScannedAtDesc(String tenantId);

    List<AttendanceScan> findByTenantIdAndScanDateKeyOrderByScannedAtDesc(
            String tenantId, String scanDateKey);
}
