package com.saas.school.modules.exam.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A single internal-assessment mark for a (student, subject, component,
 * period) tuple.
 *
 * <p>Used for Subject components whose {@code assessmentMode} is
 * {@code INTERNAL} — e.g. 10th English's 20-mark Internal Assessment, or
 * a project portion of Computer Science. These marks don't go through
 * Exam records; the teacher enters one number per student at the end of
 * each period (term or year, see {@code Component.internalSchedule}).
 *
 * <p>{@code termId} is required when the component's
 * {@code internalSchedule} is {@code PER_TERM}, and left null when the
 * schedule is {@code PER_YEAR}. The compound unique index ensures only
 * one row exists per (student, subject, component, year, term) — so a
 * teacher re-entering a mark overwrites the same row instead of
 * accumulating duplicates.
 */
@Document(collection = "component_internal_marks")
@CompoundIndexes({
    @CompoundIndex(
        name = "student_subject_component_year_term_idx",
        def = "{'studentId':1,'subjectId':1,'componentKey':1,'academicYearId':1,'termId':1}",
        unique = true
    )
})
public class ComponentInternalMark {

    @Id
    private String markId;

    private String studentId;
    private String subjectId;

    /** Which component on the subject this mark scores. Required. */
    private String componentKey;

    private String academicYearId;

    /**
     * The term this mark belongs to. Required when the component's
     * {@code internalSchedule} is {@code PER_TERM}; null when the
     * schedule is {@code PER_YEAR}.
     */
    private String termId;

    private Double marksObtained;

    /** User ID of the teacher / admin who entered the mark. */
    private String enteredBy;

    private String remarks;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public ComponentInternalMark() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getMarkId() { return markId; }
    public void setMarkId(String markId) { this.markId = markId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getComponentKey() { return componentKey; }
    public void setComponentKey(String componentKey) { this.componentKey = componentKey; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getTermId() { return termId; }
    public void setTermId(String termId) { this.termId = termId; }

    public Double getMarksObtained() { return marksObtained; }
    public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }

    public String getEnteredBy() { return enteredBy; }
    public void setEnteredBy(String enteredBy) { this.enteredBy = enteredBy; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
