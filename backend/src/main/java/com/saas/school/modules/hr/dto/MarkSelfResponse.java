package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.EmployeeAttendance;

import java.time.Instant;

/**
 * Response for {@code POST /mark-self}. Wraps enough of the fresh
 * attendance row for the frontend to update the "My Attendance" card
 * in place (status chip + timestamps + distance for audit).
 */
public class MarkSelfResponse {

    private String attendanceId;
    private String status;
    private Instant inTime;
    private Instant outTime;
    private boolean late;
    private Double distanceFromCampusMeters;
    /** IN or OUT — which punch this call landed. Drives the snackbar
     *  copy ("Marked IN at 08:42 AM" vs "Marked OUT at 04:15 PM"). */
    private String punchDirection;

    public MarkSelfResponse() {}

    public static MarkSelfResponse from(EmployeeAttendance att, String punchDirection) {
        MarkSelfResponse r = new MarkSelfResponse();
        r.attendanceId = att.getAttendanceId();
        r.status = att.getStatus();
        r.inTime = att.getInTime();
        r.outTime = att.getOutTime();
        r.late = att.isLate();
        r.distanceFromCampusMeters = att.getDistanceFromCampusMeters();
        r.punchDirection = punchDirection;
        return r;
    }

    public String getAttendanceId() { return attendanceId; }
    public void setAttendanceId(String v) { this.attendanceId = v; }

    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }

    public Instant getInTime() { return inTime; }
    public void setInTime(Instant v) { this.inTime = v; }

    public Instant getOutTime() { return outTime; }
    public void setOutTime(Instant v) { this.outTime = v; }

    public boolean isLate() { return late; }
    public void setLate(boolean v) { this.late = v; }

    public Double getDistanceFromCampusMeters() { return distanceFromCampusMeters; }
    public void setDistanceFromCampusMeters(Double v) { this.distanceFromCampusMeters = v; }

    public String getPunchDirection() { return punchDirection; }
    public void setPunchDirection(String v) { this.punchDirection = v; }
}
