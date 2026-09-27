package com.saas.school.modules.fee.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "fee_structures")
public class FeeStructure {
    @Id
    private String feeStructureId;
    private String academicYearId;
    private String classId;
    private FeeType feeType;
    private double amount;
    /**
     * True when this class offers a hostel option. Gates the per-student
     * hostel toggle on the Fee Payments page and controls whether the
     * ledger materializer ever considers a hostel line for this class.
     * Old rows deserialize as false — zero-touch migration.
     */
    private boolean hostelEnabled;
    /**
     * True when the school charges different hostel fees for boys vs
     * girls in this class. Uses {@link #hostelBoysAmount} /
     * {@link #hostelGirlsAmount} keyed on {@code Student.gender} when
     * true; otherwise falls back to the single {@link #hostelAmount}.
     */
    private boolean hostelGenderSplit;
    /** Single hostel add-on — used when {@link #hostelEnabled}=true AND
     *  {@link #hostelGenderSplit}=false. */
    private double hostelAmount;
    /** Boys hostel fee — used when {@link #hostelGenderSplit}=true. */
    private double hostelBoysAmount;
    /** Girls hostel fee — used when {@link #hostelGenderSplit}=true. */
    private double hostelGirlsAmount;
    private LocalDate dueDate;
    private String description;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public FeeStructure() {
    }

    public FeeStructure(String feeStructureId, String academicYearId, String classId, FeeType feeType,
                        double amount, LocalDate dueDate, String description, Instant createdAt) {
        this.feeStructureId = feeStructureId;
        this.academicYearId = academicYearId;
        this.classId = classId;
        this.feeType = feeType;
        this.amount = amount;
        this.dueDate = dueDate;
        this.description = description;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getFeeStructureId() {
        return feeStructureId;
    }

    public void setFeeStructureId(String feeStructureId) {
        this.feeStructureId = feeStructureId;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public FeeType getFeeType() {
        return feeType;
    }

    public void setFeeType(FeeType feeType) {
        this.feeType = feeType;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public boolean isHostelEnabled() { return hostelEnabled; }
    public void setHostelEnabled(boolean hostelEnabled) { this.hostelEnabled = hostelEnabled; }

    public boolean isHostelGenderSplit() { return hostelGenderSplit; }
    public void setHostelGenderSplit(boolean hostelGenderSplit) { this.hostelGenderSplit = hostelGenderSplit; }

    public double getHostelAmount() { return hostelAmount; }
    public void setHostelAmount(double hostelAmount) { this.hostelAmount = hostelAmount; }

    public double getHostelBoysAmount() { return hostelBoysAmount; }
    public void setHostelBoysAmount(double hostelBoysAmount) { this.hostelBoysAmount = hostelBoysAmount; }

    public double getHostelGirlsAmount() { return hostelGirlsAmount; }
    public void setHostelGirlsAmount(double hostelGirlsAmount) { this.hostelGirlsAmount = hostelGirlsAmount; }

    /** Resolve the hostel amount for a specific student based on this
     *  structure's config. Returns 0 when hostel isn't enabled for this
     *  class. Gender fallback: if split is on but gender is unset,
     *  returns 0 (admin flagged this student as hostel resident
     *  without a gender — safer to skip than guess). */
    public double resolveHostelAmountFor(String gender) {
        if (!hostelEnabled) return 0;
        if (!hostelGenderSplit) return hostelAmount;
        if (gender == null) return 0;
        if ("MALE".equalsIgnoreCase(gender)) return hostelBoysAmount;
        if ("FEMALE".equalsIgnoreCase(gender)) return hostelGirlsAmount;
        // OTHER — no gender-specific amount. Fall back to whichever is
        // non-zero, or 0 if both are unset. Rare case; admin decision.
        return hostelBoysAmount > 0 ? hostelBoysAmount : hostelGirlsAmount;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum FeeType { TUITION, EXAM, LABORATORY, SPORTS, TRANSPORT, LIBRARY, OTHER }
}
