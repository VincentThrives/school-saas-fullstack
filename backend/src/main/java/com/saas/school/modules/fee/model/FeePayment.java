package com.saas.school.modules.fee.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "fee_payments")
public class FeePayment {
    @Id
    private String paymentId;
    private String receiptNumber;
    private String studentId;
    private String classId;
    private String feeStructureId;
    private double amountPaid;
    private LocalDate paymentDate;
    private PaymentMode paymentMode;
    private String remarks;
    private String recordedBy;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public FeePayment() {
    }

    public FeePayment(String paymentId, String receiptNumber, String studentId, String classId,
                      String feeStructureId, double amountPaid, LocalDate paymentDate,
                      PaymentMode paymentMode, String remarks, String recordedBy, Instant createdAt) {
        this.paymentId = paymentId;
        this.receiptNumber = receiptNumber;
        this.studentId = studentId;
        this.classId = classId;
        this.feeStructureId = feeStructureId;
        this.amountPaid = amountPaid;
        this.paymentDate = paymentDate;
        this.paymentMode = paymentMode;
        this.remarks = remarks;
        this.recordedBy = recordedBy;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public String getReceiptNumber() {
        return receiptNumber;
    }

    public void setReceiptNumber(String receiptNumber) {
        this.receiptNumber = receiptNumber;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getFeeStructureId() {
        return feeStructureId;
    }

    public void setFeeStructureId(String feeStructureId) {
        this.feeStructureId = feeStructureId;
    }

    public double getAmountPaid() {
        return amountPaid;
    }

    public void setAmountPaid(double amountPaid) {
        this.amountPaid = amountPaid;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public PaymentMode getPaymentMode() {
        return paymentMode;
    }

    public void setPaymentMode(PaymentMode paymentMode) {
        this.paymentMode = paymentMode;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public String getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(String recordedBy) {
        this.recordedBy = recordedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum PaymentMode { CASH, ONLINE, CHEQUE, DD, OTHER }
}
