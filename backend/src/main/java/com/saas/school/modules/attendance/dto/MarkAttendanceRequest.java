package com.saas.school.modules.attendance.dto;

import com.saas.school.modules.attendance.model.Attendance.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class MarkAttendanceRequest {

    @NotBlank
    private String classId;

    @NotBlank
    private String sectionId;

    private String academicYearId;

    @NotNull
    private LocalDate date;

    @NotNull
    private List<AttendanceEntry> entries;

    private String subjectId;
    private String subjectName;
    private String teacherId;
    private int periodNumber;

    /**
     * Which component of the subject this attendance is for —
     * "theory" or "practical" on a hybrid subject, for example.
     * Required when the subject has multiple components that track
     * attendance; auto-filled for single-component subjects.
     */
    private String componentKey;

    /**
     * Which teaching sub-part of the subject this attendance is for —
     * "physics" / "chemistry" / "biology" under an integrated Science
     * course. Orthogonal to {@link #componentKey}; both can be set when
     * a subject defines BOTH a marks-side component AND a teaching-side
     * sub-part. Null for subjects without sub-parts.
     */
    private String subPartKey;

    /**
     * Snapshotted activity label ("CET", "Assembly", "PE", ...) used
     * only by the admin activity-attendance flow. Set when
     * {@link #subjectId} is null and {@link #periodNumber} is
     * non-zero; ignored otherwise. Snapshot rather than lookup so a
     * later timetable edit doesn't rewrite the label on historical
     * rows.
     */
    private String activityLabel;

    public MarkAttendanceRequest() {
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getSectionId() {
        return sectionId;
    }

    public void setSectionId(String sectionId) {
        this.sectionId = sectionId;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public List<AttendanceEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<AttendanceEntry> entries) {
        this.entries = entries;
    }

    public String getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(String subjectId) {
        this.subjectId = subjectId;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public int getPeriodNumber() {
        return periodNumber;
    }

    public void setPeriodNumber(int periodNumber) {
        this.periodNumber = periodNumber;
    }

    public String getComponentKey() {
        return componentKey;
    }

    public void setComponentKey(String componentKey) {
        this.componentKey = componentKey;
    }

    public String getSubPartKey() {
        return subPartKey;
    }

    public void setSubPartKey(String subPartKey) {
        this.subPartKey = subPartKey;
    }

    public String getActivityLabel() {
        return activityLabel;
    }

    public void setActivityLabel(String activityLabel) {
        this.activityLabel = activityLabel;
    }

    public static class AttendanceEntry {

        private String studentId;
        private Status status;
        private String remarks;

        public AttendanceEntry() {
        }

        public String getStudentId() {
            return studentId;
        }

        public void setStudentId(String studentId) {
            this.studentId = studentId;
        }

        public Status getStatus() {
            return status;
        }

        public void setStatus(Status status) {
            this.status = status;
        }

        public String getRemarks() {
            return remarks;
        }

        public void setRemarks(String remarks) {
            this.remarks = remarks;
        }
    }
}
