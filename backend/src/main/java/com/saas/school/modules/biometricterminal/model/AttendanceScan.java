package com.saas.school.modules.biometricterminal.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One row per successfully-attributed scan pushed by a biometric
 * terminal. Ledger-style: the row stays even after roll-up into
 * StudentsAttendance so audits ("when did device SN X see student Y?")
 * are answerable years later without cross-referencing anything.
 */
@Document(collection = "attendance_scans")
@CompoundIndexes({
    // Powers the 120s dedup query — we look up "did we already see this
    // student go IN/OUT today?" before writing. Non-unique because a
    // student may legitimately punch multiple times per direction over a
    // day (e.g. re-entry after early leave); dedup happens in the service.
    @CompoundIndex(name = "tenant_student_day_direction",
        def = "{'tenantId':1,'studentId':1,'scanDateKey':1,'direction':1}")
})
public class AttendanceScan {

    @Id
    private String scanId;

    @Indexed
    private String tenantId;

    private String studentId;
    private String terminalSerial;
    private String terminalUserId;

    private ScanMethod method;
    private Direction direction;
    private ScanStatus status;

    private Instant scannedAt;
    /** yyyy-MM-dd in the school's local zone — the day the scan counts
     *  for, kept as a string so it participates in the compound index
     *  without any timezone drift at query time. */
    private String scanDateKey;

    /** Set when this scan has been materialised into StudentsAttendance;
     *  null on scans that never got rolled up (e.g. the rare failure
     *  path where the class/section couldn't be resolved). */
    private Instant rolledUpAt;

    @CreatedDate
    private Instant createdAt;

    public AttendanceScan() {}

    public String getScanId() { return scanId; }
    public void setScanId(String scanId) { this.scanId = scanId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public ScanMethod getMethod() { return method; }
    public void setMethod(ScanMethod method) { this.method = method; }

    public Direction getDirection() { return direction; }
    public void setDirection(Direction direction) { this.direction = direction; }

    public ScanStatus getStatus() { return status; }
    public void setStatus(ScanStatus status) { this.status = status; }

    public Instant getScannedAt() { return scannedAt; }
    public void setScannedAt(Instant scannedAt) { this.scannedAt = scannedAt; }

    public String getScanDateKey() { return scanDateKey; }
    public void setScanDateKey(String scanDateKey) { this.scanDateKey = scanDateKey; }

    public Instant getRolledUpAt() { return rolledUpAt; }
    public void setRolledUpAt(Instant rolledUpAt) { this.rolledUpAt = rolledUpAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public enum Direction { IN, OUT }

    public enum ScanMethod {
        /** Scan pushed by an eSSL/ZKTeco ADMS terminal at the school gate. */
        EXTERNAL_TERMINAL
    }

    public enum ScanStatus { PRESENT, LATE, EARLY_LEAVE }
}
