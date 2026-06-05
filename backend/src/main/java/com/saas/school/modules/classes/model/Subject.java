package com.saas.school.modules.classes.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * A subject in a school's curriculum, modelled as one or more
 * {@link Component}s — each with its own marks scheme, attendance rule
 * and assessment mode.
 *
 * <p>The component shape replaces the old single-purpose THEORY /
 * PRACTICAL / ELECTIVE type enum. It lets a school describe everything
 * from a plain 5th-grade Hindi paper (one component, EXAM mode) to a
 * PUC II Physics subject with separate Theory and Practical papers
 * (two components, both EXAM mode, both attendance-tracked) to a 10th
 * English with a 20-mark internal assessment (two components — Theory
 * EXAM-mode with attendance, Internal Assessment INTERNAL-mode without
 * attendance).
 *
 * <p>Teacher assignments live in {@code TeacherSubjectAssignment} and
 * reference subjects by {@code subjectId} + an optional {@code
 * componentKey} (required when the subject has more than one
 * component).
 */
@Document(collection = "subjects")
public class Subject {
    @Id
    private String subjectId;
    private String name;
    private String code;
    private String classId;
    private String academicYearId;

    /**
     * How a student "passes" this subject across its components.
     * Defaults to {@link PassRule#PER_COMPONENT} (CBSE / ICSE style —
     * each component must be cleared individually).
     */
    private PassRule passRule = PassRule.PER_COMPONENT;

    /**
     * The make-up of this subject. Must contain at least one entry.
     * A subject with a single component renders compactly on the
     * report card; multiple components render with a per-component
     * breakdown plus a total row.
     */
    private List<Component> components;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public Subject() {
    }

    public Subject(String subjectId, String name, String code, String classId, String academicYearId,
                   PassRule passRule, List<Component> components, Instant createdAt) {
        this.subjectId = subjectId;
        this.name = name;
        this.code = code;
        this.classId = classId;
        this.academicYearId = academicYearId;
        this.passRule = passRule == null ? PassRule.PER_COMPONENT : passRule;
        this.components = components;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public PassRule getPassRule() { return passRule == null ? PassRule.PER_COMPONENT : passRule; }
    public void setPassRule(PassRule passRule) { this.passRule = passRule; }

    public List<Component> getComponents() { return components; }
    public void setComponents(List<Component> components) { this.components = components; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    // ── Convenience ───────────────────────────────────────────────

    /**
     * Look up a component by its {@code key}. Used by Exam, Attendance
     * and ReportCard services to validate that a referenced component
     * actually exists on the subject before doing further work.
     */
    public Component componentByKey(String key) {
        if (components == null || key == null) return null;
        for (Component c : components) {
            if (key.equals(c.getKey())) return c;
        }
        return null;
    }

    /**
     * True when the subject has more than one component — i.e. a
     * Hybrid / Theory+Internal / Theory+Practical+Project setup.
     * Callers use this to decide whether {@code componentKey} is
     * required on downstream operations (exam create, attendance
     * mark, teacher assignment).
     */
    public boolean isMultiComponent() {
        return components != null && components.size() > 1;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum PassRule {
        /** Student must clear every component individually. CBSE / ICSE default. */
        PER_COMPONENT,
        /** Student passes if the sum of obtained marks meets the sum of component pass marks. */
        COMBINED
    }

    public enum AssessmentMode {
        /**
         * Marks come from one or more Exam records. Term total is the
         * sum (or max — to be configured per term scheme) of those
         * exam marks for this component.
         */
        EXAM,
        /**
         * Marks come from an internal assessment — assignments,
         * project work, classroom observation. No Exam record is
         * created; a single number is entered per student per period
         * (per term or per year — see {@link InternalSchedule}).
         */
        INTERNAL
    }

    public enum InternalSchedule {
        /** One mark per student per term, per component. */
        PER_TERM,
        /** One mark per student per academic year, per component. */
        PER_YEAR
    }

    /**
     * One slice of a subject — e.g. "Theory", "Practical",
     * "Internal Assessment". Each component has its own marks scheme
     * and decides independently whether attendance is tracked for it
     * and how marks are gathered (exam vs internal).
     */
    public static class Component {
        /**
         * Stable machine key used by Exam, Attendance and
         * TeacherSubjectAssignment to refer to this component. Lower
         * snake_case, e.g. "theory", "practical", "internal",
         * "project". Must be unique within a Subject.
         */
        private String key;

        /** Human-readable label, shown on report cards: "Theory", "Practical (Lab)", etc. */
        private String label;

        private Integer maxMarks;
        private Integer passMarks;

        /**
         * When true, attendance for this component flows through the
         * normal mark-attendance UI and counts toward the per-component
         * attendance % on reports. When false (Internal Assessment,
         * project work), the component is invisible to the attendance
         * module.
         */
        private boolean trackAttendance;

        private AssessmentMode assessmentMode;

        /**
         * Only meaningful when {@code assessmentMode == INTERNAL}.
         * Defaults to {@link InternalSchedule#PER_TERM}.
         */
        private InternalSchedule internalSchedule;

        public Component() {
        }

        public Component(String key, String label, Integer maxMarks, Integer passMarks,
                         boolean trackAttendance, AssessmentMode assessmentMode,
                         InternalSchedule internalSchedule) {
            this.key = key;
            this.label = label;
            this.maxMarks = maxMarks;
            this.passMarks = passMarks;
            this.trackAttendance = trackAttendance;
            this.assessmentMode = assessmentMode;
            this.internalSchedule = internalSchedule;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public Integer getMaxMarks() { return maxMarks; }
        public void setMaxMarks(Integer maxMarks) { this.maxMarks = maxMarks; }

        public Integer getPassMarks() { return passMarks; }
        public void setPassMarks(Integer passMarks) { this.passMarks = passMarks; }

        public boolean isTrackAttendance() { return trackAttendance; }
        public void setTrackAttendance(boolean trackAttendance) { this.trackAttendance = trackAttendance; }

        public AssessmentMode getAssessmentMode() { return assessmentMode; }
        public void setAssessmentMode(AssessmentMode assessmentMode) { this.assessmentMode = assessmentMode; }

        public InternalSchedule getInternalSchedule() { return internalSchedule; }
        public void setInternalSchedule(InternalSchedule internalSchedule) { this.internalSchedule = internalSchedule; }
    }
}
