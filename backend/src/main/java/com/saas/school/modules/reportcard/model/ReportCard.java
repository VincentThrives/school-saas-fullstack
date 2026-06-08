package com.saas.school.modules.reportcard.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "report_cards")
public class ReportCard {

    @Id
    private String id;
    private String studentId;
    private String studentName;
    private String classId;
    private String className;
    private String academicYearId;
    private String academicYearLabel;
    private String examType; // null/empty = All exam types
    private List<SubjectGrade> subjects;
    private double totalMarks;
    private double totalMaxMarks;
    private double percentage;
    private String grade;
    private int rank;
    private double attendancePercentage;
    private String teacherRemarks;
    private String principalRemarks;
    /**
     * Overall pass/fail across all subjects on this report card. True iff
     * EVERY subject's {@link SubjectGrade#passed} flag is true. Per-subject
     * pass is itself computed from the subject's {@code passRule}
     * (PER_COMPONENT / COMBINED), so a Practical at 10/30 fails the
     * subject and therefore the whole card — regardless of the overall
     * percentage being above 35.
     */
    private boolean passed = true;

    @CreatedDate
    private Instant generatedAt;

    public ReportCard() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public String getAcademicYearLabel() {
        return academicYearLabel;
    }

    public void setAcademicYearLabel(String academicYearLabel) {
        this.academicYearLabel = academicYearLabel;
    }

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public List<SubjectGrade> getSubjects() {
        return subjects;
    }

    public void setSubjects(List<SubjectGrade> subjects) {
        this.subjects = subjects;
    }

    public double getTotalMarks() {
        return totalMarks;
    }

    public void setTotalMarks(double totalMarks) {
        this.totalMarks = totalMarks;
    }

    public double getTotalMaxMarks() {
        return totalMaxMarks;
    }

    public void setTotalMaxMarks(double totalMaxMarks) {
        this.totalMaxMarks = totalMaxMarks;
    }

    public double getPercentage() {
        return percentage;
    }

    public void setPercentage(double percentage) {
        this.percentage = percentage;
    }

    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }

    public int getRank() {
        return rank;
    }

    public void setRank(int rank) {
        this.rank = rank;
    }

    public double getAttendancePercentage() {
        return attendancePercentage;
    }

    public void setAttendancePercentage(double attendancePercentage) {
        this.attendancePercentage = attendancePercentage;
    }

    public String getTeacherRemarks() {
        return teacherRemarks;
    }

    public void setTeacherRemarks(String teacherRemarks) {
        this.teacherRemarks = teacherRemarks;
    }

    public String getPrincipalRemarks() {
        return principalRemarks;
    }

    public void setPrincipalRemarks(String principalRemarks) {
        this.principalRemarks = principalRemarks;
    }

    public boolean isPassed() { return passed; }
    public void setPassed(boolean passed) { this.passed = passed; }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant generatedAt) {
        this.generatedAt = generatedAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    /**
     * One row per subject on the report card. For single-component
     * subjects the {@code components} list has exactly one entry and
     * the totals on this row equal that component's marks; the UI can
     * render it as a compact one-line row. For multi-component
     * subjects (Physics with Theory + Practical, English with Theory
     * + Internal Assessment, etc.) the list has one entry per
     * component and the totals are the sums — the UI renders an
     * expandable parent row with sub-rows.
     */
    public static class SubjectGrade {
        private String subjectId;
        private String subjectName;
        private double marksObtained;
        private double maxMarks;
        private String grade;
        private String teacherRemarks;
        private boolean absent;
        /**
         * Pass / Fail at the subject level, computed from the
         * subject's {@code passRule}:
         *  - PER_COMPONENT: passed iff every component passed
         *  - COMBINED: passed iff marksObtained &gt;= sum of component pass marks
         */
        private boolean passed = true;
        /** Per-component breakdown. Always populated (single-component subjects have one entry). */
        private List<ComponentGrade> components;

        public SubjectGrade() {
        }

        public SubjectGrade(String subjectName, double marksObtained, double maxMarks, String grade, String teacherRemarks) {
            this.subjectName = subjectName;
            this.marksObtained = marksObtained;
            this.maxMarks = maxMarks;
            this.grade = grade;
            this.teacherRemarks = teacherRemarks;
        }

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

        public String getSubjectName() {
            return subjectName;
        }

        public void setSubjectName(String subjectName) {
            this.subjectName = subjectName;
        }

        public double getMarksObtained() {
            return marksObtained;
        }

        public void setMarksObtained(double marksObtained) {
            this.marksObtained = marksObtained;
        }

        public double getMaxMarks() {
            return maxMarks;
        }

        public void setMaxMarks(double maxMarks) {
            this.maxMarks = maxMarks;
        }

        public String getGrade() {
            return grade;
        }

        public void setGrade(String grade) {
            this.grade = grade;
        }

        public String getTeacherRemarks() {
            return teacherRemarks;
        }

        public void setTeacherRemarks(String teacherRemarks) {
            this.teacherRemarks = teacherRemarks;
        }

        public boolean isAbsent() { return absent; }
        public void setAbsent(boolean absent) { this.absent = absent; }

        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }

        public List<ComponentGrade> getComponents() { return components; }
        public void setComponents(List<ComponentGrade> components) { this.components = components; }
    }

    /**
     * One row per component within a subject. Carries everything the
     * UI needs to render the per-component line (label, marks,
     * pass/fail, attendance %).
     */
    public static class ComponentGrade {
        private String key;
        private String label;
        private double marksObtained;
        private double maxMarks;
        private double passMarks;
        private boolean passed;
        /**
         * Attendance % for this component, or null when the component
         * is not attendance-tracked (e.g. an Internal Assessment).
         */
        private Double attendancePercentage;
        /** Either "EXAM" or "INTERNAL" — lets the UI tag the row. */
        private String assessmentMode;

        public ComponentGrade() {
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(double marksObtained) { this.marksObtained = marksObtained; }

        public double getMaxMarks() { return maxMarks; }
        public void setMaxMarks(double maxMarks) { this.maxMarks = maxMarks; }

        public double getPassMarks() { return passMarks; }
        public void setPassMarks(double passMarks) { this.passMarks = passMarks; }

        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }

        public Double getAttendancePercentage() { return attendancePercentage; }
        public void setAttendancePercentage(Double attendancePercentage) { this.attendancePercentage = attendancePercentage; }

        public String getAssessmentMode() { return assessmentMode; }
        public void setAssessmentMode(String assessmentMode) { this.assessmentMode = assessmentMode; }
    }
}
