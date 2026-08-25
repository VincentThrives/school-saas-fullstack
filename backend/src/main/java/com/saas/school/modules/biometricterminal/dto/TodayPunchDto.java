package com.saas.school.modules.biometricterminal.dto;

import java.time.Instant;

/**
 * One row in the "Today's Punches" per-terminal audit view.
 * Includes both RECORDED and DROPPED scans so admins can see why an
 * accidental tap didn't fire a parent SMS (drop reason spells it out).
 */
public class TodayPunchDto {
    private String scanId;
    /** ISO instant — frontend renders in the browser's local zone,
     *  which for Indian schools resolves to IST via the OS. */
    private Instant scannedAt;
    private String terminalUserId;
    private String studentId;
    /** Best-effort display name; null when the terminal user id has
     *  no active binding (in which case the scan itself would have
     *  been dropped in AdmsPushController before reaching us — this
     *  is here for defensive display). */
    private String studentName;
    /** "IN" or "OUT" as decided by AttendanceScanService — reflects
     *  our verdict, not the device's raw byte. Null on very old
     *  scans written before the outcome-tagging change. */
    private String direction;
    /** RECORDED | DROPPED_DUPLICATE | DROPPED_BEFORE_EXIT_WINDOW |
     *  DROPPED_ALREADY_LEFT. */
    private String outcome;
    /** Human-readable "why was this dropped?" — null on RECORDED. */
    private String dropReason;

    public TodayPunchDto() {}

    public String getScanId() { return scanId; }
    public void setScanId(String scanId) { this.scanId = scanId; }

    public Instant getScannedAt() { return scannedAt; }
    public void setScannedAt(Instant scannedAt) { this.scannedAt = scannedAt; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }

    public String getDropReason() { return dropReason; }
    public void setDropReason(String dropReason) { this.dropReason = dropReason; }
}
