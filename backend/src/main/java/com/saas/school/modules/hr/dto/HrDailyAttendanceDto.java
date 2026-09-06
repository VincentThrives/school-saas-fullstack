package com.saas.school.modules.hr.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One row on the HR Daily Attendance page. Wraps
 * {@link com.saas.school.modules.hr.model.EmployeeAttendance} with
 * the employee's display name + designation baked in, so the frontend
 * doesn't need to make a second call to
 * {@code GET /api/v1/employees} — which is gated to admin roles and
 * would 403 for HR users.
 */
public class HrDailyAttendanceDto {

    private String attendanceId;
    private String employeeId;
    private String employeeName;
    /** Teacher.employeeRole — e.g. "TEACHER", "PRINCIPAL",
     *  "ACCOUNTANT". Shown as a subtitle under the name. Null for
     *  older Teacher rows with no designation stamped. */
    private String designation;

    private LocalDate date;
    /** PRESENT | LATE | HALF_DAY | ABSENT — same vocabulary as
     *  {@code EmployeeAttendance.status}. */
    private String status;
    private boolean late;

    private Instant inTime;
    private Instant outTime;

    /** LOCATION | BIOMETRIC | MANUAL | REGULARIZATION — drives the
     *  source icon on the row. */
    private String source;

    /** Only meaningful for LOCATION rows — how far the employee was
     *  from the campus point at mark time. */
    private Double distanceFromCampusMeters;
    private Double markAccuracyMeters;

    private String remarks;

    public HrDailyAttendanceDto() {}

    public String getAttendanceId() { return attendanceId; }
    public void setAttendanceId(String attendanceId) { this.attendanceId = attendanceId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isLate() { return late; }
    public void setLate(boolean late) { this.late = late; }

    public Instant getInTime() { return inTime; }
    public void setInTime(Instant inTime) { this.inTime = inTime; }

    public Instant getOutTime() { return outTime; }
    public void setOutTime(Instant outTime) { this.outTime = outTime; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Double getDistanceFromCampusMeters() { return distanceFromCampusMeters; }
    public void setDistanceFromCampusMeters(Double distanceFromCampusMeters) {
        this.distanceFromCampusMeters = distanceFromCampusMeters;
    }

    public Double getMarkAccuracyMeters() { return markAccuracyMeters; }
    public void setMarkAccuracyMeters(Double markAccuracyMeters) {
        this.markAccuracyMeters = markAccuracyMeters;
    }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
