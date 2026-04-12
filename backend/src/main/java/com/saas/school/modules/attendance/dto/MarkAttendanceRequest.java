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

    @NotBlank
    private String academicYearId;

    @NotNull
    private LocalDate date;

    @NotNull
    private List<AttendanceEntry> entries;

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
