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
    /**
     * @deprecated Replaced by {@link #assignments}. Kept on the model so
     * the legacy field deserialises cleanly from documents stored before
     * the assignments refactor; the migration runner moves the value
     * into the first {@link Assignment} on boot. New code MUST NOT read
     * this field — use {@link #getAssignments()} or
     * {@link #firstClassId()} instead.
     */
    @Deprecated
    private String classId;
    private String academicYearId;
    /**
     * The classes + sections this subject is taught in. A subject with
     * the same component scheme across many classes is ONE document with
     * many assignments — no duplicate Subject rows in the list view.
     * When the scheme legitimately differs between classes (e.g. Kannada
     * Theory 100 in Class 5 but Theory 80 + IA 20 in Class 10), those
     * are two separate Subject documents.
     */
    private List<Assignment> assignments;

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

    /** @deprecated use {@link #getAssignments()} / {@link #firstClassId()}. */
    @Deprecated
    public String getClassId() { return classId; }
    /** @deprecated use {@link #setAssignments(List)}. */
    @Deprecated
    public void setClassId(String classId) { this.classId = classId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public List<Assignment> getAssignments() { return assignments; }
    public void setAssignments(List<Assignment> assignments) { this.assignments = assignments; }

    /**
     * First {@code classId} on this subject's assignments — used as a
     * pragmatic stand-in for the old single-class shape during the
     * transition (e.g. the report card aggregator that still wants to
     * resolve a "primary class" for the subject when generating
     * marks-by-class reports). Returns null if the subject has no
     * assignments yet (transient state during creation).
     */
    public String firstClassId() {
        if (assignments == null || assignments.isEmpty()) return null;
        return assignments.get(0).getClassId();
    }

    /** True if this subject is assigned to the given class. */
    public boolean isAssignedToClass(String classId) {
        if (classId == null || assignments == null) return false;
        for (Assignment a : assignments) {
            if (classId.equals(a.getClassId())) return true;
        }
        return false;
    }

    /**
     * Look up the section ids this subject is assigned to in the given
     * class. Returns an empty list if the subject isn't assigned to that
     * class.
     */
    public List<String> sectionIdsForClass(String classId) {
        if (classId == null || assignments == null) return java.util.Collections.emptyList();
        for (Assignment a : assignments) {
            if (classId.equals(a.getClassId())) {
                return a.getSectionIds() == null ? java.util.Collections.emptyList() : a.getSectionIds();
            }
        }
        return java.util.Collections.emptyList();
    }

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

    /**
     * One class the subject is taught in, plus the sections of that
     * class where it applies. A Subject's component scheme is shared
     * across all its assignments — if a school needs Kannada with one
     * scheme in primary classes and a different scheme in secondary,
     * those are two separate Subject documents.
     */
    public static class Assignment {
        private String classId;
        private List<String> sectionIds;

        public Assignment() {
        }

        public Assignment(String classId, List<String> sectionIds) {
            this.classId = classId;
            this.sectionIds = sectionIds;
        }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public List<String> getSectionIds() { return sectionIds; }
        public void setSectionIds(List<String> sectionIds) { this.sectionIds = sectionIds; }
    }
}
