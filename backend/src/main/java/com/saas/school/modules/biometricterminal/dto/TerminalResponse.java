package com.saas.school.modules.biometricterminal.dto;

import java.time.Instant;

/**
 * List-row payload for the Attendance Terminals admin page. Beyond the
 * registration data (serial + label + bindings), carries a small
 * activity snapshot so the operator can see at a glance whether the
 * device is actually pushing scans:
 * <ul>
 *   <li>{@link #lastSeenAt} — heartbeat / cdata call timestamp</li>
 *   <li>{@link #todaysScanCount} — how many scans the box has processed today</li>
 *   <li>{@link #lastScanStudentName}, {@link #lastScanDirection},
 *       {@link #lastScanAt} — "Anu B · IN at 08:42" style summary of
 *       the freshest scan across all its bindings</li>
 * </ul>
 * Activity fields are null when the terminal has never pushed a scan.
 */
public class TerminalResponse {

    private String serial;
    private String label;
    private Instant lastSeenAt;
    private long bindingCount;
    private Instant createdAt;

    // Activity snapshot (populated on list responses).
    private long todaysScanCount;
    private String lastScanStudentName;
    /** "IN" or "OUT" — matches AttendanceScan.Direction. */
    private String lastScanDirection;
    private Instant lastScanAt;

    public TerminalResponse() {}

    public TerminalResponse(String serial, String label, Instant lastSeenAt,
                            long bindingCount, Instant createdAt) {
        this.serial = serial;
        this.label = label;
        this.lastSeenAt = lastSeenAt;
        this.bindingCount = bindingCount;
        this.createdAt = createdAt;
    }

    public String getSerial() { return serial; }
    public void setSerial(String serial) { this.serial = serial; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public long getBindingCount() { return bindingCount; }
    public void setBindingCount(long bindingCount) { this.bindingCount = bindingCount; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public long getTodaysScanCount() { return todaysScanCount; }
    public void setTodaysScanCount(long todaysScanCount) { this.todaysScanCount = todaysScanCount; }

    public String getLastScanStudentName() { return lastScanStudentName; }
    public void setLastScanStudentName(String lastScanStudentName) { this.lastScanStudentName = lastScanStudentName; }

    public String getLastScanDirection() { return lastScanDirection; }
    public void setLastScanDirection(String lastScanDirection) { this.lastScanDirection = lastScanDirection; }

    public Instant getLastScanAt() { return lastScanAt; }
    public void setLastScanAt(Instant lastScanAt) { this.lastScanAt = lastScanAt; }
}
