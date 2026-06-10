package com.saas.school.modules.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

/**
 * Bulk exam creation — admin picks one exam type, multi-selects class+section
 * pairs and subjects, and the backend fans out into one Exam doc per (pair ×
 * subject-config).
 *
 * <p>Per subject, admin chooses combined mode (one exam carrying all
 * components — Theory + IA shown side-by-side in mark entry) or
 * per-component mode (separate exam doc per component).
 *
 * <p>This DTO is intentionally flat — the backend explodes it into individual
 * Exam docs that look identical to ones created via the legacy single-exam
 * form, so all downstream code (list, edit, mark entry, report card) works
 * without change.
 */
public class BulkCreateExamRequest {

    @NotBlank
    private String examType;

    @NotBlank
    private String academicYearId;

    /** Optional default date — admin can override per-exam after creation. */
    private LocalDate examDate;
    private String startTime;
    private String endTime;
    private String description;

    /** Class + section pairs the exams apply to. */
    @NotNull
    private List<ClassSection> pairs;

    /** One per picked subject; carries the per-component max/pass. */
    @NotNull
    private List<SubjectConfig> subjectConfigs;

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public LocalDate getExamDate() { return examDate; }
    public void setExamDate(LocalDate examDate) { this.examDate = examDate; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<ClassSection> getPairs() { return pairs; }
    public void setPairs(List<ClassSection> pairs) { this.pairs = pairs; }

    public List<SubjectConfig> getSubjectConfigs() { return subjectConfigs; }
    public void setSubjectConfigs(List<SubjectConfig> subjectConfigs) { this.subjectConfigs = subjectConfigs; }

    public static class ClassSection {
        private String classId;
        private String sectionId;

        public ClassSection() {}
        public ClassSection(String classId, String sectionId) {
            this.classId = classId;
            this.sectionId = sectionId;
        }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    }

    public static class SubjectConfig {
        private String subjectId;
        /**
         * True → create ONE exam doc holding all components in
         * {@link #components}. False → create N exam docs, one per
         * component. Single-component subjects ignore this flag and always
         * produce one exam doc.
         */
        private boolean combined;
        /**
         * The components to include, each with its OWN max + pass for this
         * exam. Subject.Component caps are intentionally ignored here —
         * admin enters per-exam marks fresh on the bulk form.
         */
        private List<ComponentConfig> components;

        public SubjectConfig() {}

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

        public boolean isCombined() { return combined; }
        public void setCombined(boolean combined) { this.combined = combined; }

        public List<ComponentConfig> getComponents() { return components; }
        public void setComponents(List<ComponentConfig> components) { this.components = components; }
    }

    public static class ComponentConfig {
        private String key;
        private String label;
        private Integer maxMarks;
        private Integer passingMarks;

        public ComponentConfig() {}

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public Integer getMaxMarks() { return maxMarks; }
        public void setMaxMarks(Integer maxMarks) { this.maxMarks = maxMarks; }

        public Integer getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Integer passingMarks) { this.passingMarks = passingMarks; }
    }
}
