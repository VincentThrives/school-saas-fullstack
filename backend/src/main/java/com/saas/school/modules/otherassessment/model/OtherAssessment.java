package com.saas.school.modules.otherassessment.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A generic non-academic assessment (weekly CET tests, mock exams,
 * competitive practice papers, ...). One document per (class, section,
 * assessment) with the full roster and per-subject marks nested inside
 * — so a single Mongo read hydrates the entire class's data.
 *
 * <p>Intentionally NOT stored in the {@code exams} collection: this
 * data doesn't flow into report cards or the academic mark-entry
 * pipeline. Keeping it in {@code other_assessment} lets it evolve
 * without risk to the existing exam / report card code paths.</p>
 */
@Document(collection = "other_assessment")
@CompoundIndexes({
    // Admin list view: filter by (class, section, year) and optionally
    // by type ("CET", "Mock", ...) so week-wise tests group cleanly.
    @CompoundIndex(name = "class_section_year_type",
        def = "{'classId':1,'sectionId':1,'academicYearId':1,'type':1}")
})
public class OtherAssessment {
    @Id
    private String assessmentId;

    private String academicYearId;
    private String classId;
    private String sectionId;

    /** Free-form label ("CET Week 1", "Mock 1", "Weekly Test 3"). */
    private String name;

    /** Free-form category so the admin list can group ("CET",
     *  "Mock", "Weekly Test", ...). Not an enum — schools invent
     *  their own labels. */
    private String type;

    private LocalDate testDate;

    /** Snapshot of the subjects being tested in this assessment. Max
     *  marks live here so a school can vary Physics from 45 to 50
     *  between weeks without editing every historical row. */
    private List<SubjectSpec> subjects = new ArrayList<>();

    /** Snapshot of the class roster at assessment-creation time, plus
     *  each student's per-subject marks. Denormalised on purpose:
     *  a student who leaves the school later still has their history
     *  on the assessment doc. */
    private List<StudentEntry> students = new ArrayList<>();

    private String createdBy;
    private String updatedBy;

    /** Soft-delete marker. Non-null → archived and excluded from the
     *  admin list; hard-delete via the controller drops the row for
     *  real. Kept as an Instant so the "archived on" timestamp is
     *  available for later restore / audit UIs. */
    private Instant deletedAt;
    private String deletedBy;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public OtherAssessment() {}

    // ── Getters / setters ────────────────────────────────────────

    public String getAssessmentId() { return assessmentId; }
    public void setAssessmentId(String assessmentId) { this.assessmentId = assessmentId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public LocalDate getTestDate() { return testDate; }
    public void setTestDate(LocalDate testDate) { this.testDate = testDate; }

    public List<SubjectSpec> getSubjects() { return subjects; }
    public void setSubjects(List<SubjectSpec> subjects) { this.subjects = subjects; }

    public List<StudentEntry> getStudents() { return students; }
    public void setStudents(List<StudentEntry> students) { this.students = students; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public String getDeletedBy() { return deletedBy; }
    public void setDeletedBy(String deletedBy) { this.deletedBy = deletedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    // ── Nested shapes ────────────────────────────────────────────

    /** Per-subject spec on an assessment: which subject, and what
     *  max marks apply for THIS assessment. Name is snapshotted so
     *  a later subject rename doesn't rewrite history. */
    public static class SubjectSpec {
        private String subjectId;
        private String subjectName;
        private Integer maxMarks;

        public SubjectSpec() {}
        public SubjectSpec(String subjectId, String subjectName, Integer maxMarks) {
            this.subjectId = subjectId;
            this.subjectName = subjectName;
            this.maxMarks = maxMarks;
        }
        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public Integer getMaxMarks() { return maxMarks; }
        public void setMaxMarks(Integer maxMarks) { this.maxMarks = maxMarks; }
    }

    /** Per-student row on an assessment. Roll number + name are
     *  snapshotted so a transfer / withdrawal later doesn't wipe
     *  the history. Marks stored as one entry per subject on this
     *  student — indexed by the SubjectSpec's subjectId. */
    public static class StudentEntry {
        private String studentId;
        private String rollNumber;
        /** Admission number snapshot — mandatory in production, so it
         *  doubles as a reliable match key when the bulk-upload Excel
         *  arrives ranked (or with missing / inconsistent roll numbers).
         *  Nullable for legacy assessments created before this field
         *  landed; the template service falls back to a live Student
         *  lookup in that case. */
        private String admissionNumber;
        private String fullName;
        private List<SubjectMark> subjects = new ArrayList<>();
        private String remark;
        /** Rank within the assessment (1-based). Standard ranking —
         *  ties share a rank, the next rank skips ("1, 2, 2, 4").
         *  Null when the student has no marks entered yet, or when
         *  no student on the assessment does (rank isn't meaningful
         *  before scoring begins). Computed on every save; parents /
         *  students see it on their per-assessment card. */
        private Integer rank;

        public StudentEntry() {}
        public StudentEntry(String studentId, String rollNumber, String fullName) {
            this.studentId = studentId;
            this.rollNumber = rollNumber;
            this.fullName = fullName;
        }
        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }
        public String getRollNumber() { return rollNumber; }
        public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
        public String getAdmissionNumber() { return admissionNumber; }
        public void setAdmissionNumber(String admissionNumber) { this.admissionNumber = admissionNumber; }
        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }
        public List<SubjectMark> getSubjects() { return subjects; }
        public void setSubjects(List<SubjectMark> subjects) { this.subjects = subjects; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
        public Integer getRank() { return rank; }
        public void setRank(Integer rank) { this.rank = rank; }
    }

    /** One student's mark on one subject of the assessment.
     *  {@code marksObtained} is nullable — a fresh row starts blank
     *  until the admin enters marks. */
    public static class SubjectMark {
        private String subjectId;
        private Double marksObtained;
        private String remark;

        public SubjectMark() {}
        public SubjectMark(String subjectId, Double marksObtained) {
            this.subjectId = subjectId;
            this.marksObtained = marksObtained;
        }
        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public Double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
    }
}
