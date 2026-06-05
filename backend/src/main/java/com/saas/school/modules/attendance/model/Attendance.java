package com.saas.school.modules.attendance.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "attendance")
@CompoundIndexes({
    // componentKey lets the same student/date/subject have separate rows
    // for the "theory" and "practical" portions of a hybrid subject —
    // needed for PUC-style subjects where Theory and Practical have
    // their own classes and independently-tracked attendance.
    @CompoundIndex(
        name = "student_date_subject_component",
        def = "{'studentId':1,'date':1,'subjectId':1,'componentKey':1,'periodNumber':1}"
    )
})
public class Attendance {
    @Id
    private String attendanceId;
    private String studentId;
    private String classId;
    private String sectionId;
    private String academicYearId;
    private LocalDate date;
    private Status status;
    private String markedBy;
    private String remarks;
    private String subjectId;
    private String subjectName;

    /**
     * Which {@code Subject.Component} this attendance row belongs to.
     *
     * <p>Required when the subject has more than one component AND
     * that component is configured with {@code trackAttendance=true}.
     * Auto-filled for single-component subjects so older clients
     * continue to work.
     */
    private String componentKey;

    private int periodNumber;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // ── Constructors ──────────────────────────────────────────────

    public Attendance() {
    }

    public Attendance(String attendanceId, String studentId, String classId, String sectionId,
                      String academicYearId, LocalDate date, Status status, String markedBy,
                      String remarks, Instant createdAt, Instant updatedAt) {
        this.attendanceId = attendanceId;
        this.studentId = studentId;
        this.classId = classId;
        this.sectionId = sectionId;
        this.academicYearId = academicYearId;
        this.date = date;
        this.status = status;
        this.markedBy = markedBy;
        this.remarks = remarks;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getAttendanceId() {
        return attendanceId;
    }

    public void setAttendanceId(String attendanceId) {
        this.attendanceId = attendanceId;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
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

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getMarkedBy() {
        return markedBy;
    }

    public void setMarkedBy(String markedBy) {
        this.markedBy = markedBy;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum Status { PRESENT, ABSENT, LATE, HALF_DAY, HOLIDAY }
}
