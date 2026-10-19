package com.saas.school.modules.examscheme.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Assessment scheme a school runs (Karnataka pattern: FA1..FA4 + SA1/SA2, or
 * any custom mix). One document per scheme; each scheme carries the slots that
 * make it up — raw → weighted marks, per-subject rows, pull-forward wiring —
 * plus the classes it applies to, scoped to one academic year.
 *
 * <p>Each slot references an {@link com.saas.school.modules.examtype.model.ExamType}
 * entry by {@link Slot#typeId} (the "Exam Type" dropdown in the editor). The
 * {@link Slot#label} is the exam NAME (e.g. "FA1"), while the referenced type
 * is the exam TYPE (e.g. "FA"). When exams are rolled out, each generated
 * {@code Exam} doc stamps the type's name onto {@code exam.examType} and the
 * slot's label onto {@code exam.name}.
 */
@Document(collection = "exam_schemes")
public class Scheme {

    @Id
    private String id;

    private String name;                  // e.g. "Karnataka Pattern" — unique per tenant+year
    private int displayOrder;
    private String description;
    private Status status;
    private String academicYearId;        // scopes the scheme to one year
    private List<String> applicableClassIds = new ArrayList<>();
    private List<Slot> slots;
    /** Scheme-wide default pass bar as a whole-number percentage (0..100).
     *  Admin edits this once + hits "Sync" to recompute every slot / subject-
     *  row / component pass to {@code round(max * percent/100)}. Nullable for
     *  legacy docs — defaults to 35 when missing. */
    private Integer passingPercent;

    @CreatedDate  private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    public Scheme() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public List<String> getApplicableClassIds() { return applicableClassIds; }
    public void setApplicableClassIds(List<String> applicableClassIds) {
        this.applicableClassIds = applicableClassIds == null ? new ArrayList<>() : applicableClassIds;
    }

    public List<Slot> getSlots() { return slots; }
    public void setSlots(List<Slot> slots) { this.slots = slots; }

    public Integer getPassingPercent() { return passingPercent; }
    public void setPassingPercent(Integer passingPercent) { this.passingPercent = passingPercent; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public enum Status { ACTIVE, ARCHIVED }

    /**
     * One row in the scheme (e.g. "FA1 — 20 raw → 10 weighted, pass 4").
     * Each slot references an {@link com.saas.school.modules.examtype.model.ExamType}
     * entry by id — that's the "Exam Type" (FA/SA/Monthly/…). The slot's own
     * {@link #label} is the exam NAME (FA1, SA1, Monthly-1, …).
     */
    public static class Slot {
        private String key;                 // stable id derived from label — used by Exam docs
        private String label;               // Exam Name — e.g. "FA1"
        private String typeId;              // → ExamType.id (the Exam Type: FA / SA / …)
        private String term;                // free text, e.g. "Term 1"
        private double rawMax;
        private double weightMax;
        private Double passingMarks;

        // Phase 2 — all nullable, backward-compat
        private List<Component> components;        // optional — sub-pieces that sum to rawMax
        private PullForward pullForward;           // optional — scales marks from earlier slots
        private Boolean includeInGrandTotal;       // null → true; false hides from final total
        private List<SubjectConfig> subjectConfigs; // null/empty → fall back to defaults

        public Slot() {}

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getTypeId() { return typeId; }
        public void setTypeId(String typeId) { this.typeId = typeId; }

        public String getTerm() { return term; }
        public void setTerm(String term) { this.term = term; }

        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }

        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }

        public Double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Double passingMarks) { this.passingMarks = passingMarks; }

        public List<Component> getComponents() { return components; }
        public void setComponents(List<Component> components) { this.components = components; }

        public PullForward getPullForward() { return pullForward; }
        public void setPullForward(PullForward pullForward) { this.pullForward = pullForward; }

        public Boolean getIncludeInGrandTotal() { return includeInGrandTotal; }
        public void setIncludeInGrandTotal(Boolean includeInGrandTotal) {
            this.includeInGrandTotal = includeInGrandTotal;
        }

        public List<SubjectConfig> getSubjectConfigs() { return subjectConfigs; }
        public void setSubjectConfigs(List<SubjectConfig> subjectConfigs) { this.subjectConfigs = subjectConfigs; }

        public boolean countsInGrandTotal() {
            return includeInGrandTotal == null || includeInGrandTotal;
        }
    }

    /**
     * One component of a slot — picked FROM the applicable Subject's own
     * components (Theory, Project, IA, …), so {@link #key} matches a
     * {@code Subject.Component.key} on at least one applicable subject.
     *
     * <p>Optionally splits into {@link #subComponents} (e.g. Theory = Paper 1 +
     * Paper 2) for finer-grained mark entry — those live only on the scheme /
     * exam side, never on the subject. When {@code subComponents} is null or
     * empty, marks are entered against this component directly.
     *
     * <p>{@code passingMarks} is boxed because older scheme docs don't carry it;
     * a null value tells rollout to fall back to the scheme-wide pass %.
     */
    public static class Component {
        private String key;
        private String label;
        private double maxMarks;
        private Double passingMarks;
        /** Null or empty → marks entered at component level. Non-empty → one
         *  mark column per sub-component, component total = sum of sub-parts. */
        private List<SubComponent> subComponents;

        public Component() {}

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public double getMaxMarks() { return maxMarks; }
        public void setMaxMarks(double maxMarks) { this.maxMarks = maxMarks; }
        public Double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Double passingMarks) { this.passingMarks = passingMarks; }
        public List<SubComponent> getSubComponents() { return subComponents; }
        public void setSubComponents(List<SubComponent> subComponents) { this.subComponents = subComponents; }
    }

    /**
     * A finer split of a {@link Component} for THIS slot only (e.g. Theory split
     * into Paper 1 + Paper 2). Sub-component {@code maxMarks} values must sum to
     * their parent component's max. Pass is a sum rule: the parent component
     * passes when sum(sub-part marks) >= parent.passingMarks (rule (a)); the
     * per-sub-part {@code passingMarks} is advisory, used for display only.
     */
    public static class SubComponent {
        private String key;
        private String label;
        private double maxMarks;
        private Double passingMarks;

        public SubComponent() {}

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public double getMaxMarks() { return maxMarks; }
        public void setMaxMarks(double maxMarks) { this.maxMarks = maxMarks; }
        public Double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Double passingMarks) { this.passingMarks = passingMarks; }
    }

    /** One subject's config inside a slot. */
    public static class SubjectConfig {
        private String subjectId;
        private double rawMax;
        private double weightMax;
        private Double passingMarks;
        private Double pulledContributionMax;

        public SubjectConfig() {}

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public double getRawMax() { return rawMax; }
        public void setRawMax(double rawMax) { this.rawMax = rawMax; }
        public double getWeightMax() { return weightMax; }
        public void setWeightMax(double weightMax) { this.weightMax = weightMax; }
        public Double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(Double passingMarks) { this.passingMarks = passingMarks; }
        public Double getPulledContributionMax() { return pulledContributionMax; }
        public void setPulledContributionMax(Double pulledContributionMax) {
            this.pulledContributionMax = pulledContributionMax;
        }
    }

    /** Pull-forward rule — scales marks from earlier slots into this one. */
    public static class PullForward {
        private List<String> fromSlotKeys = new ArrayList<>();
        private double contributionMax;

        public PullForward() {}

        public List<String> getFromSlotKeys() { return fromSlotKeys; }
        public void setFromSlotKeys(List<String> fromSlotKeys) {
            this.fromSlotKeys = fromSlotKeys == null ? new ArrayList<>() : fromSlotKeys;
        }

        public double getContributionMax() { return contributionMax; }
        public void setContributionMax(double contributionMax) { this.contributionMax = contributionMax; }
    }
}
