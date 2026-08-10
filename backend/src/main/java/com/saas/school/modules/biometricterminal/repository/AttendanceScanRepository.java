package com.saas.school.modules.biometricterminal.repository;

import com.saas.school.modules.biometricterminal.model.AttendanceScan;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface AttendanceScanRepository extends MongoRepository<AttendanceScan, String> {

    /** Dedup lookup — returns every scan for the (student, day, direction)
     *  triple so the service can decide whether the most-recent one is
     *  within the 120s idempotency window. */
    List<AttendanceScan> findByStudentIdAndScanDateKeyAndDirection(
        String studentId, String scanDateKey, AttendanceScan.Direction direction);

    /** Was this exact (studentId, scannedAt) already saved? Guards against
     *  the terminal replaying the same batch after a network hiccup — the
     *  timestamp is second-precision on the wire, so replays produce
     *  identical values. */
    boolean existsByStudentIdAndScannedAt(String studentId, Instant scannedAt);

    /** Newest scan from a given terminal — feeds the "last punch" line on
     *  the Attendance Terminals admin card. */
    java.util.Optional<AttendanceScan> findFirstByTerminalSerialOrderByScannedAtDesc(String terminalSerial);

    /** How many scans a terminal has processed on a given day — feeds the
     *  "N scans today" stat on the admin card. */
    long countByTerminalSerialAndScanDateKey(String terminalSerial, String scanDateKey);
}
