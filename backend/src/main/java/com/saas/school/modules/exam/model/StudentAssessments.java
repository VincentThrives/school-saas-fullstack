package com.saas.school.modules.exam.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "student_assessments")
@CompoundIndex(name = "exam_unique", def = "{'examId':1}", unique = true)
public class StudentAssessments {
    @Id
    private String id;
    private String examId;
    private String academicYearId;
    private String classId;
    private String sectionId;
    private String subjectId;
    private String teacherId;
    private List<MarkEntry> entries;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public StudentAssessments() {}

    // ── Getters and Setters ───────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getExamId() { return examId; }
    public void setExamId(String examId) { this.examId = examId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public List<MarkEntry> getEntries() { return entries; }
    public void setEntries(List<MarkEntry> entries) { this.entries = entries; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    // ── Nested type ──────────────────────────────────────────────

    public static class MarkEntry {
        private String studentId;
        private Double marksObtained;
        private String grade;
        private String remarks;
        private boolean isPassed;

        public MarkEntry() {}

        public MarkEntry(String studentId, Double marksObtained, String grade, String remarks, boolean isPassed) {
            this.studentId = studentId;
            this.marksObtained = marksObtained;
            this.grade = grade;
            this.remarks = remarks;
            this.isPassed = isPassed;
        }

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }

        public Double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }

        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }

        public String getRemarks() { return remarks; }
        public void setRemarks(String remarks) { this.remarks = remarks; }

        public boolean isPassed() { return isPassed; }
        public void setPassed(boolean passed) { isPassed = passed; }
    }
}
