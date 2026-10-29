package com.saas.school.modules.reportcard.dto;

import java.util.List;

/**
 * Scheme-based "Final" report card payload — one object reused across
 * student self-view, admin single-student view, bulk admin generation,
 * and the PDF export.
 *
 * <p>The scheme defines how FA1 / FA2 / SA1 / SA2 roll up into a Final:
 * each slot has its own {@code rawMax} / {@code weightMax} per subject
 * ({@code SubjectConfig}), and only slots with {@code includeInGrandTotal}
 * contribute to the Grand Total. This DTO flattens that structure into
 * what the UI actually needs to render: slot cards with per-subject
 * raw+weighted rows, a subject-wise rollup matrix, and the Grand Total.
 */
public class FinalReportCardDto {

    /** Who this card is for. */
    private String studentId;
    private String studentName;
    private String classId;
    private String className;
    private String sectionName;
    private String academicYearId;
    private String academicYearLabel;

    /** Scheme header (name + pass %). */
    private SchemeHeader scheme;

    /** One entry per slot in the scheme — FA1, FA2, SA1, SA2 … in display order. */
    private List<SlotRow> slots;

    /** Per-subject rollup across every slot — one row per subject. */
    private List<SubjectRollup> subjectRollup;

    /** Grand Total aggregated across slots × subjects (weighted). */
    private GrandTotal grandTotal;

    /** Final rank (section + class), both ranking by Grand Total %. */
    private RankInfo rank;

    /** PENDING / IN_PROGRESS / COMPLETED — convenience badge for the hero. */
    private Status overallStatus;

    public enum Status { PENDING, IN_PROGRESS, COMPLETED }

    public static class SchemeHeader {
        private String schemeId;
        private String name;
        private Integer passingPercent;

        public String getSchemeId() { return schemeId; }
        public void setSchemeId(String schemeId) { this.schemeId = schemeId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Integer getPassingPercent() { return passingPercent; }
        public void setPassingPercent(Integer passingPercent) { this.passingPercent = passingPercent; }
    }

    /**
     * One slot card. The slot-level numbers are sums across its subjects;
     * {@link #subjects} carries the per-subject raw+weighted breakdown
     * the UI uses to render the inner table.
     */
    public static class SlotRow {
        private String slotKey;
        private String label;              // "FA1"
        private String term;               // "Term 1" (optional)
        private boolean includedInGrandTotal = true;
        private Status status = Status.PENDING;

        private Double rawObtained;        // null when PENDING / no entries
        private double rawMax;
        private Double weightObtained;     // null when PENDING / no entries
        private double weightMax;
        private Double percentage;

        private List<SlotSubjectRow> subjects;

        public String getSlotKey() { return slotKey; }
        public void setSlotKey(String slotKey) { this.slotKey = slotKey; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getTerm() { return term; }
        public void setTerm(String term) { this.term = term; }
        public boolean isIncludedInGrandTotal() { return includedInGrandTotal; }
        public void setIncludedInGrandTotal(boolean includedInGrandTotal) { this.includedInGrandTotal = includedInGrandTotal; }
        public Status getStatus() { return status; }
        public void setStatus(Status status) { this.status = status; }
        public Double getRawObtained() { return rawObtained; }
        public void setRawObtained(Double rawObtained) { this.rawObtained = rawObtained; }
        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }
        public Double getWeightObtained() { return weightObtained; }
        public void setWeightObtained(Double weightObtained) { this.weightObtained = weightObtained; }
        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }
        public Double getPercentage() { return percentage; }
        public void setPercentage(Double percentage) { this.percentage = percentage; }
        public List<SlotSubjectRow> getSubjects() { return subjects; }
        public void setSubjects(List<SlotSubjectRow> subjects) { this.subjects = subjects; }
    }

    /** One subject's row inside a slot — the per-cell raw and weighted. */
    public static class SlotSubjectRow {
        private String subjectId;
        private String subjectName;
        private Double rawObtained;
        private double rawMax;
        private Double weightObtained;
        private double weightMax;
        private Double passingMarks;
        private Boolean passed;
        /** PENDING / COMPLETED / ABSENT / NOT_SCHEDULED — same vocabulary as per-exam view. */
        private String status;

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public Double getRawObtained() { return rawObtained; }
        public void setRawObtained(Double rawObtained) { this.rawObtained = rawObtained; }
        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }
        public Double getWeightObtained() { return weightObtained; }
        public void setWeightObtained(Double weightObtained) { this.weightObtained = weightObtained; }
        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }
        public Double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Double passingMarks) { this.passingMarks = passingMarks; }
        public Boolean getPassed() { return passed; }
        public void setPassed(Boolean passed) { this.passed = passed; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    /** One row of the per-subject rollup matrix (across all slots). */
    public static class SubjectRollup {
        private String subjectId;
        private String subjectName;
        /** Per-slot cells for this subject — same order as {@link #slots}. */
        private List<SubjectSlotCell> perSlot;
        private double totalRawObtained;
        private double totalRawMax;
        private double totalWeightObtained;
        private double totalWeightMax;
        private double percentage;          // based on weighted sums
        private String grade;
        private boolean passed;

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public List<SubjectSlotCell> getPerSlot() { return perSlot; }
        public void setPerSlot(List<SubjectSlotCell> perSlot) { this.perSlot = perSlot; }
        public double getTotalRawObtained() { return totalRawObtained; }
        public void setTotalRawObtained(double totalRawObtained) { this.totalRawObtained = totalRawObtained; }
        public double getTotalRawMax() { return totalRawMax; }
        public void setTotalRawMax(double totalRawMax) { this.totalRawMax = totalRawMax; }
        public double getTotalWeightObtained() { return totalWeightObtained; }
        public void setTotalWeightObtained(double totalWeightObtained) { this.totalWeightObtained = totalWeightObtained; }
        public double getTotalWeightMax() { return totalWeightMax; }
        public void setTotalWeightMax(double totalWeightMax) { this.totalWeightMax = totalWeightMax; }
        public double getPercentage() { return percentage; }
        public void setPercentage(double percentage) { this.percentage = percentage; }
        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }
        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }
    }

    public static class SubjectSlotCell {
        private String slotKey;
        private String slotLabel;
        private Double rawObtained;
        private double rawMax;
        private Double weightObtained;
        private double weightMax;

        public String getSlotKey() { return slotKey; }
        public void setSlotKey(String slotKey) { this.slotKey = slotKey; }
        public String getSlotLabel() { return slotLabel; }
        public void setSlotLabel(String slotLabel) { this.slotLabel = slotLabel; }
        public Double getRawObtained() { return rawObtained; }
        public void setRawObtained(Double rawObtained) { this.rawObtained = rawObtained; }
        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }
        public Double getWeightObtained() { return weightObtained; }
        public void setWeightObtained(Double weightObtained) { this.weightObtained = weightObtained; }
        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }
    }

    public static class GrandTotal {
        private double rawObtained;
        private double rawMax;
        private double weightObtained;
        private double weightMax;
        private double percentage;
        private String grade;
        private boolean passed;
        /** Projected Grand Total % if the student maintains their current
         *  completed-slot percentage into the pending slots. Null until
         *  there's at least one completed slot. */
        private Double projectedPercentage;

        public double getRawObtained() { return rawObtained; }
        public void setRawObtained(double rawObtained) { this.rawObtained = rawObtained; }
        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }
        public double getWeightObtained() { return weightObtained; }
        public void setWeightObtained(double weightObtained) { this.weightObtained = weightObtained; }
        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }
        public double getPercentage() { return percentage; }
        public void setPercentage(double percentage) { this.percentage = percentage; }
        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }
        public boolean isPassed() { return passed; }
        public void setPassed(boolean passed) { this.passed = passed; }
        public Double getProjectedPercentage() { return projectedPercentage; }
        public void setProjectedPercentage(Double projectedPercentage) { this.projectedPercentage = projectedPercentage; }
    }

    public static class RankInfo {
        /** Rank within the student's own section by Final % (0 = not ranked). */
        private int section;
        /** Rank across the whole class (all sections) by Final %. */
        private int classWide;
        public int getSection() { return section; }
        public void setSection(int section) { this.section = section; }
        public int getClassWide() { return classWide; }
        public void setClassWide(int classWide) { this.classWide = classWide; }
    }

    // ── Getters / setters for the top-level fields ──────────────────────
    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }
    public String getAcademicYearLabel() { return academicYearLabel; }
    public void setAcademicYearLabel(String academicYearLabel) { this.academicYearLabel = academicYearLabel; }
    public SchemeHeader getScheme() { return scheme; }
    public void setScheme(SchemeHeader scheme) { this.scheme = scheme; }
    public List<SlotRow> getSlots() { return slots; }
    public void setSlots(List<SlotRow> slots) { this.slots = slots; }
    public List<SubjectRollup> getSubjectRollup() { return subjectRollup; }
    public void setSubjectRollup(List<SubjectRollup> subjectRollup) { this.subjectRollup = subjectRollup; }
    public GrandTotal getGrandTotal() { return grandTotal; }
    public void setGrandTotal(GrandTotal grandTotal) { this.grandTotal = grandTotal; }
    public RankInfo getRank() { return rank; }
    public void setRank(RankInfo rank) { this.rank = rank; }
    public Status getOverallStatus() { return overallStatus; }
    public void setOverallStatus(Status overallStatus) { this.overallStatus = overallStatus; }
}
