package com.saas.school.modules.attendance.dto;

import java.time.Instant;

/**
 * One row of the daily attendance hub — surfaces, for every (class,
 * section) the school operates, whether its day-wise attendance has
 * been marked for a given date and a snapshot of the present / absent
 * counts when it has.
 *
 * <p>Drives the View Attendance dashboard the admin lands on when they
 * click "Mark Attendance" in the side nav. Cards in the "Yet to mark"
 * tab are built from rows with {@code status = NOT_MARKED}; cards in
 * the "Marked" tab carry the per-status counts so the admin gets a
 * quick visual confirmation of the morning's roll-call.</p>
 */
public class DayAttendanceStatus {

    public static final String STATUS_MARKED = "MARKED";
    public static final String STATUS_NOT_MARKED = "NOT_MARKED";

    private String classId;
    private String className;
    private String sectionId;
    private String sectionName;
    private int studentCount;
    private String status;          // MARKED or NOT_MARKED
    private Instant markedAt;       // null when NOT_MARKED
    private int presentCount;
    private int absentCount;
    private int otherCount;         // LATE + HALF_DAY collapsed

    public DayAttendanceStatus() {}

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public int getStudentCount() { return studentCount; }
    public void setStudentCount(int studentCount) { this.studentCount = studentCount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getMarkedAt() { return markedAt; }
    public void setMarkedAt(Instant markedAt) { this.markedAt = markedAt; }

    public int getPresentCount() { return presentCount; }
    public void setPresentCount(int presentCount) { this.presentCount = presentCount; }

    public int getAbsentCount() { return absentCount; }
    public void setAbsentCount(int absentCount) { this.absentCount = absentCount; }

    public int getOtherCount() { return otherCount; }
    public void setOtherCount(int otherCount) { this.otherCount = otherCount; }
}
