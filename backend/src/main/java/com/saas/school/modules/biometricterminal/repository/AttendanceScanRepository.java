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
     *  the Attendance Terminals admin card. Includes DROPPED scans; use
     *  {@link #findFirstByTerminalSerialAndOutcomeOrderByScannedAtDesc}
     *  when you want only actionable ones. */
    java.util.Optional<AttendanceScan> findFirstByTerminalSerialOrderByScannedAtDesc(String terminalSerial);

    /** Newest RECORDED scan from a terminal — filters out silent drops
     *  (accidental re-scans past the daily quota) so the admin card's
     *  "Last punch" matches what actually got processed. */
    java.util.Optional<AttendanceScan> findFirstByTerminalSerialAndOutcomeOrderByScannedAtDesc(
        String terminalSerial, AttendanceScan.ScanOutcome outcome);

    /** How many scans a terminal has processed on a given day — feeds the
     *  "N scans today" stat on the admin card. */
    long countByTerminalSerialAndScanDateKey(String terminalSerial, String scanDateKey);

    /** How many actionable (non-dropped) scans a terminal has processed
     *  on a given day — feeds the "N scans today" stat in a way that
     *  ignores accidental re-scans that got silent-dropped. */
    long countByTerminalSerialAndScanDateKeyAndOutcome(
        String terminalSerial, String scanDateKey, AttendanceScan.ScanOutcome outcome);

    /** All scans (RECORDED + DROPPED) for one terminal on one day,
     *  newest first — feeds the "Today's Punches" audit dialog on the
     *  Attendance Terminals card. Deliberately unfiltered by outcome
     *  because the whole point of that view is to help the admin
     *  understand why a physical tap didn't turn into attendance. */
    java.util.List<AttendanceScan> findByTerminalSerialAndScanDateKeyOrderByScannedAtDesc(
        String terminalSerial, String scanDateKey);
}
