package com.saas.school.modules.attendance.dto;

public class AttendanceSummaryDto {

    private String studentId;
    private long totalDays;
    private long present;
    private long absent;
    private long late;
    private long halfDay;
    private double attendancePercentage;

    public AttendanceSummaryDto() {
    }

    public AttendanceSummaryDto(String studentId, long totalDays, long present, long absent,
                                long late, long halfDay, double attendancePercentage) {
        this.studentId = studentId;
        this.totalDays = totalDays;
        this.present = present;
        this.absent = absent;
        this.late = late;
        this.halfDay = halfDay;
        this.attendancePercentage = attendancePercentage;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public long getTotalDays() {
        return totalDays;
    }

    public void setTotalDays(long totalDays) {
        this.totalDays = totalDays;
    }

    public long getPresent() {
        return present;
    }

    public void setPresent(long present) {
        this.present = present;
    }

    public long getAbsent() {
        return absent;
    }

    public void setAbsent(long absent) {
        this.absent = absent;
    }

    public long getLate() {
        return late;
    }

    public void setLate(long late) {
        this.late = late;
    }

    public long getHalfDay() {
        return halfDay;
    }

    public void setHalfDay(long halfDay) {
        this.halfDay = halfDay;
    }

    public double getAttendancePercentage() {
        return attendancePercentage;
    }

    public void setAttendancePercentage(double attendancePercentage) {
        this.attendancePercentage = attendancePercentage;
    }
}
