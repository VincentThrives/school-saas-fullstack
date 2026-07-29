package com.saas.school.modules.biometric.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One scan event. Append-only ledger of every card tap and face match
 * the kiosk produced. Feeds the Attendance dashboard's live health page
 * and the roll-up into {@code students_attendance}.
 *
 * <p>The compound index enforces idempotency: a duplicate submission
 * from a flaky network will collide on {@code (tenantId, studentId,
 * scanDateKey)} instead of double-marking the student.</p>
 */
@Document(collection = "attendance_scans")
@CompoundIndexes({
    @CompoundIndex(
        name = "unique_scan_per_student_per_day",
        def = "{'tenantId':1,'studentId':1,'scanDateKey':1}",
        unique = true
    )
})
public class AttendanceScan {

    @Id
    private String scanId;

    @Indexed
    private String tenantId;

    private String studentId;
    private String deviceId;

    /** How the scan happened — CARD or FACE. Recorded so the teacher's
     *  attendance grid can show a small badge indicating source. */
    private ScanMethod method;

    /** Attendance status derived on ingest — PRESENT if before the
     *  tenant's late cutoff, LATE otherwise. */
    private ScanStatus status;

    private Instant scannedAt;

    /** {@code yyyy-MM-dd} in the tenant's timezone; used as the
     *  idempotency key so two scans on the same calendar day don't
     *  double-write. */
    private String scanDateKey;

    private Instant rolledUpAt;

    @CreatedDate
    private Instant createdAt;

    public AttendanceScan() {}

    public enum ScanMethod { CARD, FACE }
    public enum ScanStatus { PRESENT, LATE }

    public String getScanId() { return scanId; }
    public void setScanId(String scanId) { this.scanId = scanId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public ScanMethod getMethod() { return method; }
    public void setMethod(ScanMethod method) { this.method = method; }

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
}
