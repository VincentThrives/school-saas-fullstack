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
