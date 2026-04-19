package com.saas.school.modules.fee.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * One document per (student, academic year). All payments for that pair are
 * embedded in the {@link #payments} array so we don't explode the fee_payments
 * collection into many rows per student.
 *
 * Multi-tenant routing is handled by TenantMongoDbFactory, so no tenantId
 * field is needed.
 */
@Document(collection = "student_fee_ledgers")
@CompoundIndex(name = "student_year_idx", def = "{'studentId':1,'academicYearId':1}", unique = true)
@CompoundIndex(name = "roster_idx", def = "{'academicYearId':1,'classId':1,'sectionId':1}")
@CompoundIndex(name = "status_idx", def = "{'academicYearId':1,'status':1}")
public class StudentFeeLedger {

    @Id
    private String ledgerId;

    // Student snapshot
    private String studentId;
    private String studentName;
    private String admissionNumber;
    private String rollNumber;

    // Class / section / year snapshot (at time of first payment; editable on class change)
    private String classId;
    private String className;
    private String sectionId;
    private String sectionName;
    private String academicYearId;
    private String academicYearLabel;

    private String feeStructureId;

    // Totals (stored, NOT computed on read)
    private double totalFee;          // snapshot of the fee structure amount
    private double concession;        // any waiver
    private double totalDue;          // totalFee - concession
    private double totalPaid;         // sum(payments[!voided].amount)
    private double balance;           // totalDue - totalPaid
    private Status status = Status.UNPAID;

    private LocalDate dueDate;        // for OVERDUE detection

    // The running timeline of transactions.
    private List<Payment> payments = new ArrayList<>();

    // Append-only audit mirror of every mutation event (optional, kept in-doc for simplicity).
    private List<PaymentCorrection> corrections = new ArrayList<>();

    @Version
    private Long version;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public StudentFeeLedger() {}

    // ── Getters and Setters ─────────────────────────────────────────

    public String getLedgerId() { return ledgerId; }
    public void setLedgerId(String ledgerId) { this.ledgerId = ledgerId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getAdmissionNumber() { return admissionNumber; }
    public void setAdmissionNumber(String admissionNumber) { this.admissionNumber = admissionNumber; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getAcademicYearLabel() { return academicYearLabel; }
    public void setAcademicYearLabel(String academicYearLabel) { this.academicYearLabel = academicYearLabel; }

    public String getFeeStructureId() { return feeStructureId; }
    public void setFeeStructureId(String feeStructureId) { this.feeStructureId = feeStructureId; }

    public double getTotalFee() { return totalFee; }
    public void setTotalFee(double totalFee) { this.totalFee = totalFee; }

    public double getConcession() { return concession; }
    public void setConcession(double concession) { this.concession = concession; }

    public double getTotalDue() { return totalDue; }
    public void setTotalDue(double totalDue) { this.totalDue = totalDue; }

    public double getTotalPaid() { return totalPaid; }
    public void setTotalPaid(double totalPaid) { this.totalPaid = totalPaid; }

    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public List<Payment> getPayments() { return payments; }
    public void setPayments(List<Payment> payments) { this.payments = payments == null ? new ArrayList<>() : payments; }

    public List<PaymentCorrection> getCorrections() { return corrections; }
    public void setCorrections(List<PaymentCorrection> corrections) { this.corrections = corrections == null ? new ArrayList<>() : corrections; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    // ── Nested types ────────────────────────────────────────────────

    public enum Status { UNPAID, PARTIAL, PAID, OVERDUE }

    public enum PaymentMode { CASH, ONLINE, UPI, CHEQUE, DD, CARD, OTHER }

    /** One entry in the embedded payment history. */
    public static class Payment {
        private String paymentId;           // UUID, stable forever
        private String receiptNumber;       // monotonic per school (e.g. "REC-0001")
        private double amount;
        private PaymentMode mode;
        private LocalDate paidAt;
        private String collectedByUserId;
        private String collectedByName;
        private String notes;

        // Void state — we NEVER delete; voided payments stay visible in history.
        private Instant voidedAt;
        private String voidedByUserId;
        private String voidReason;

        // Correction chain — if this payment supersedes a previous one.
        private String supersededPaymentId;

        private Instant createdAt;

        public Payment() {}

        public String getPaymentId() { return paymentId; }
        public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

        public String getReceiptNumber() { return receiptNumber; }
        public void setReceiptNumber(String receiptNumber) { this.receiptNumber = receiptNumber; }

        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }

        public PaymentMode getMode() { return mode; }
        public void setMode(PaymentMode mode) { this.mode = mode; }

        public LocalDate getPaidAt() { return paidAt; }
        public void setPaidAt(LocalDate paidAt) { this.paidAt = paidAt; }

        public String getCollectedByUserId() { return collectedByUserId; }
        public void setCollectedByUserId(String collectedByUserId) { this.collectedByUserId = collectedByUserId; }

        public String getCollectedByName() { return collectedByName; }
        public void setCollectedByName(String collectedByName) { this.collectedByName = collectedByName; }

        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }

        public Instant getVoidedAt() { return voidedAt; }
        public void setVoidedAt(Instant voidedAt) { this.voidedAt = voidedAt; }

        public String getVoidedByUserId() { return voidedByUserId; }
        public void setVoidedByUserId(String voidedByUserId) { this.voidedByUserId = voidedByUserId; }

        public String getVoidReason() { return voidReason; }
        public void setVoidReason(String voidReason) { this.voidReason = voidReason; }

        public String getSupersededPaymentId() { return supersededPaymentId; }
        public void setSupersededPaymentId(String supersededPaymentId) { this.supersededPaymentId = supersededPaymentId; }

        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

        public boolean isVoided() { return voidedAt != null; }
    }

    /** Append-only audit event describing a mutation to the ledger. */
    public static class PaymentCorrection {
        private String correctionId;
        private String paymentId;      // which payment was touched
        private String action;         // "APPEND" | "EDIT" | "VOID"
        private String reason;
        private String byUserId;
        private Instant at;

        public PaymentCorrection() {}

        public String getCorrectionId() { return correctionId; }
        public void setCorrectionId(String correctionId) { this.correctionId = correctionId; }

        public String getPaymentId() { return paymentId; }
        public void setPaymentId(String paymentId) { this.paymentId = paymentId; }

        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }

        public String getByUserId() { return byUserId; }
        public void setByUserId(String byUserId) { this.byUserId = byUserId; }

        public Instant getAt() { return at; }
        public void setAt(Instant at) { this.at = at; }
    }
}
