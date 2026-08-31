package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One attendance record per employee per date. Written by any of three
 * sources — location-based self-marking, biometric terminal scan, or
 * admin manual entry — and read back by both the employee (My
 * Attendance) and HR (Daily / Monthly views + reports).
 *
 * <p>A single day always yields at most ONE document per employee; the
 * unique index on {@code (employeeId, date)} enforces this at the
 * MongoDB layer so a race between an in-flight self-mark and a
 * terminal scan can't produce duplicate rows.</p>
 *
 * <p>Departure marking ({@link #outTime}) is optional — schools that
 * configure {@code expectedPunchesPerDay = 1} skip it entirely; schools
 * with 2 punches populate it on the second mark of the day.</p>
 */
@Document(collection = "employee_attendance")
@CompoundIndexes({
    @CompoundIndex(name = "employee_date_unique",
        def = "{'employeeId': 1, 'date': 1}", unique = true),
    // For HR "Daily view — everyone today" and the auto-absent job.
    @CompoundIndex(name = "date_status",
        def = "{'date': 1, 'status': 1}"),
})
public class EmployeeAttendance {

    @Id
    private String attendanceId;

    private String employeeId;

    private LocalDate date;

    /**
     * PRESENT / ABSENT / LATE / HALF_DAY. Computed at mark time from
     * the configured thresholds — we snapshot the value here rather
     * than derive on read so a settings change tomorrow doesn't
     * retroactively re-label today's punches.
     */
    private String status;

    /** First (or only) IN punch. Null on ABSENT rows. */
    private Instant inTime;

    /** OUT punch — only populated for tenants with
     *  {@code expectedPunchesPerDay >= 2}. Null otherwise. */
    private Instant outTime;

    /** LOCATION / BIOMETRIC / MANUAL / REGULARIZATION. Drives the
     *  source-badge column in the HR daily view + the audit log. */
    private String source;

    /**
     * Snapshot of where the phone said the employee was at mark time
     * — LOCATION source only. Kept for the audit trail (HR can spot-
     * check suspicious marks in the review pane) and for the future
     * "map view" showing today's punches on the campus map.
     */
    private Double markLatitude;
    private Double markLongitude;
    /** GPS accuracy the browser reported (meters). Rows with a value
     *  above the tenant's threshold are rejected before we get here;
     *  storing it makes the "why was this OK?" trail complete. */
    private Double markAccuracyMeters;
    /** Straight-line distance (haversine) from the punch location to
     *  the tenant's campus centre at mark time. Zero for on-campus
     *  marks; up to the tenant's {@code allowedRadiusMeters} for edge
     *  marks. */
    private Double distanceFromCampusMeters;

    /**
     * True when the browser flagged the location as a mock GPS
     * provider (Android developer options). Even when the tenant has
     * rejection off, we keep the flag so an audit review can spot
     * suspicious patterns later.
     */
    private boolean mockLocation;

    /**
     * userId of whoever caused the write. For LOCATION source this is
     * the employee's own userId (self-mark); for BIOMETRIC it's
     * {@code SYSTEM} (the ADMS scan pipeline); for MANUAL it's the
     * HR admin who typed it; for REGULARIZATION it's the approver.
     */
    private String markedByUserId;

    /** True when the arrival was after the tenant's late threshold.
     *  Frozen at mark time — a threshold change tomorrow does NOT
     *  retroactively flip today's punches. */
    private boolean late;

    private String remarks;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public EmployeeAttendance() {}

    // ── Getters / setters ──────────────────────────────────────

    public String getAttendanceId() { return attendanceId; }
    public void setAttendanceId(String attendanceId) { this.attendanceId = attendanceId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getInTime() { return inTime; }
    public void setInTime(Instant inTime) { this.inTime = inTime; }

    public Instant getOutTime() { return outTime; }
    public void setOutTime(Instant outTime) { this.outTime = outTime; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Double getMarkLatitude() { return markLatitude; }
    public void setMarkLatitude(Double markLatitude) { this.markLatitude = markLatitude; }

    public Double getMarkLongitude() { return markLongitude; }
    public void setMarkLongitude(Double markLongitude) { this.markLongitude = markLongitude; }

    public Double getMarkAccuracyMeters() { return markAccuracyMeters; }
    public void setMarkAccuracyMeters(Double markAccuracyMeters) { this.markAccuracyMeters = markAccuracyMeters; }

    public Double getDistanceFromCampusMeters() { return distanceFromCampusMeters; }
    public void setDistanceFromCampusMeters(Double distanceFromCampusMeters) {
        this.distanceFromCampusMeters = distanceFromCampusMeters;
    }

    public boolean isMockLocation() { return mockLocation; }
    public void setMockLocation(boolean mockLocation) { this.mockLocation = mockLocation; }

    public String getMarkedByUserId() { return markedByUserId; }
    public void setMarkedByUserId(String markedByUserId) { this.markedByUserId = markedByUserId; }

    public boolean isLate() { return late; }
    public void setLate(boolean late) { this.late = late; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
