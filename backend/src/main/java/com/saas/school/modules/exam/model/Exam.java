package com.saas.school.modules.exam.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "exams")
public class Exam {
    @Id
    private String examId;
    private String name;
    private String classId;
    private String sectionId;
    private String subjectId;
    /**
     * Which {@code Subject.Component} this exam scores.
     *
     * <p>Required when the subject has more than one component (e.g. a
     * PUC II Physics subject with separate "theory" and "practical"
     * components — an exam belongs to one or the other). Null is
     * acceptable for single-component subjects, where the only
     * component is unambiguous.
     *
     * <p>An exam can never be created against an INTERNAL-mode
     * component — those marks come from
     * {@code ComponentInternalMark}, not from Exam records.
     */
    private String componentKey;
    private String academicYearId;
    private int maxMarks;
    private int passingMarks;
    private LocalDate examDate;
    private ExamStatus status;
    private boolean marksLocked;
    private String examType;
    private String startTime;
    private String endTime;
    private String description;
    private String subjectName;
    private String className;
    private String sectionName;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public Exam() {
    }

    public Exam(String examId, String name, String classId, String sectionId, String subjectId,
                String academicYearId, int maxMarks, int passingMarks, LocalDate examDate,
                ExamStatus status, boolean marksLocked, Instant createdAt) {
        this.examId = examId;
        this.name = name;
        this.classId = classId;
        this.sectionId = sectionId;
        this.subjectId = subjectId;
        this.academicYearId = academicYearId;
        this.maxMarks = maxMarks;
        this.passingMarks = passingMarks;
        this.examDate = examDate;
        this.status = status;
        this.marksLocked = marksLocked;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getExamId() {
        return examId;
    }

    public void setExamId(String examId) {
        this.examId = examId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public String getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(String subjectId) {
        this.subjectId = subjectId;
    }

    public String getComponentKey() {
        return componentKey;
    }

    public void setComponentKey(String componentKey) {
        this.componentKey = componentKey;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public int getMaxMarks() {
        return maxMarks;
    }

    public void setMaxMarks(int maxMarks) {
        this.maxMarks = maxMarks;
    }

    public int getPassingMarks() {
        return passingMarks;
    }

    public void setPassingMarks(int passingMarks) {
        this.passingMarks = passingMarks;
    }

    public LocalDate getExamDate() {
        return examDate;
    }

    public void setExamDate(LocalDate examDate) {
        this.examDate = examDate;
    }

    public ExamStatus getStatus() {
        return status;
    }

    public void setStatus(ExamStatus status) {
        this.status = status;
    }

    public boolean isMarksLocked() {
        return marksLocked;
    }

    public void setMarksLocked(boolean marksLocked) {
        this.marksLocked = marksLocked;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getExamType() {
        return examType;
    }

    public void setExamType(String examType) {
        this.examType = examType;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getSectionName() {
        return sectionName;
    }

    public void setSectionName(String sectionName) {
        this.sectionName = sectionName;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum ExamStatus { SCHEDULED, ONGOING, COMPLETED, CANCELLED }
}
