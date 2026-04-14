package com.saas.school.modules.attendance.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "students_attendance")
@CompoundIndexes({
    @CompoundIndex(name = "class_section_date_period",
        def = "{'classId':1,'sectionId':1,'date':1,'periodNumber':1}", unique = true)
})
public class StudentsAttendance {
    @Id
    private String id;
    private String classId;
    private String sectionId;
    private String academicYearId;
    private LocalDate date;
    private int periodNumber;       // 0 = day-wise, 1-8 = period/subject-wise
    private String subjectId;       // null for day-wise
    private String teacherId;       // from timetable
    private List<StudentEntry> entries;
    private String markedBy;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    // ── Constructors ──────────────────────────────────────────────

    public StudentsAttendance() {}

    // ── Getters and Setters ───────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public int getPeriodNumber() { return periodNumber; }
    public void setPeriodNumber(int periodNumber) { this.periodNumber = periodNumber; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public List<StudentEntry> getEntries() { return entries; }
    public void setEntries(List<StudentEntry> entries) { this.entries = entries; }

    public String getMarkedBy() { return markedBy; }
    public void setMarkedBy(String markedBy) { this.markedBy = markedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    // ── Nested types ──────────────────────────────────────────────

    public static class StudentEntry {
        private String studentId;
        private String status;      // PRESENT, ABSENT, LATE, HALF_DAY
        private String remarks;

        public StudentEntry() {}

        public StudentEntry(String studentId, String status, String remarks) {
            this.studentId = studentId;
            this.status = status;
            this.remarks = remarks;
        }

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getRemarks() { return remarks; }
        public void setRemarks(String remarks) { this.remarks = remarks; }
    }
}
