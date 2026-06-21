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
    // componentKey + subPartKey in the unique key let the same (class,
    // section, date, period) host separate attendance records for the
    // "theory" / "practical" portions of a hybrid subject AND for the
    // "physics" / "chemistry" sub-parts of an integrated Science course.
    // periodNumber is typically 0 for day-wise marking and 1-8 for
    // subject-wise.
    @CompoundIndex(name = "class_section_date_period_component_subpart",
        def = "{'classId':1,'sectionId':1,'date':1,'periodNumber':1,'componentKey':1,'subPartKey':1}", unique = true)
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
    /**
     * Which component on the subject this batch refers to. Auto-filled
     * to the only component for single-component subjects, required
     * for multi-component subjects whose target component has
     * trackAttendance=true. Null for day-wise (subjectId is null too).
     */
    private String componentKey;
    /**
     * Optional teaching-side slice (e.g. {@code "physics"} inside a
     * multi-part Science course). Set when the period's
     * {@code Timetable.Period.subPartKey} is non-null. Orthogonal to
     * {@link #componentKey} (Theory / Practical / IA). Null for
     * subjects without sub-parts — existing rows deserialise unchanged.
     */
    private String subPartKey;
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

    public String getComponentKey() { return componentKey; }
    public void setComponentKey(String componentKey) { this.componentKey = componentKey; }

    public String getSubPartKey() { return subPartKey; }
    public void setSubPartKey(String subPartKey) { this.subPartKey = subPartKey; }

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
