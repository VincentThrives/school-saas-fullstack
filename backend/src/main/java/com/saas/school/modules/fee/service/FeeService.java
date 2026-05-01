package com.saas.school.modules.fee.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.fee.model.*;
import com.saas.school.modules.fee.repository.*;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class FeeService {
    @Autowired private FeeStructureRepository structureRepo;
    @Autowired private FeePaymentRepository paymentRepo;
    @Autowired private StudentRepository studentRepo;
    @Autowired private AuditService auditService;
    @Autowired private StudentFeeLedgerRepository ledgerRepo;
    @Autowired private StudentFeeLedgerService ledgerService;

    // ── Fee Structures ────────────────────────────────────────────

    public FeeStructure createStructure(FeeStructure req) {
        req.setFeeStructureId(UUID.randomUUID().toString());
        FeeStructure saved = structureRepo.save(req);
        // Cascade: any existing ledgers for this (year, class) need their
        // totalFee snapshot refreshed so the new component is included.
        refreshLedgersFor(saved.getAcademicYearId(), saved.getClassId());
        return saved;
    }

    public FeeStructure updateStructure(String id, FeeStructure req) {
        FeeStructure existing = structureRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fee structure not found"));
        if (req.getAmount() > 0) existing.setAmount(req.getAmount());
        if (req.getDueDate() != null) existing.setDueDate(req.getDueDate());
        if (req.getDescription() != null) existing.setDescription(req.getDescription());
        if (req.getFeeType() != null) existing.setFeeType(req.getFeeType());
        FeeStructure saved = structureRepo.save(existing);
        // Cascade: refresh every ledger so balance/status reflect the new amount.
        refreshLedgersFor(saved.getAcademicYearId(), saved.getClassId());
        return saved;
    }

    public void deleteStructure(String id) {
        FeeStructure existing = structureRepo.findById(id).orElse(null);
        structureRepo.deleteById(id);
        auditService.log("DELETE_FEE_STRUCTURE", "FeeStructure", id, "Fee structure deleted");
        if (existing != null) {
            // Cascade: removing a component shrinks every ledger's totalFee.
            refreshLedgersFor(existing.getAcademicYearId(), existing.getClassId());
        }
    }

    /**
     * Recompute every {@link com.saas.school.modules.fee.model.StudentFeeLedger}
     * for the given (academicYearId, classId) so its {@code totalFee} matches
     * the current sum of all FeeStructure rows for that slot.
     *
     * Without this, a fee structure edit (e.g. ₹1,00,000 → ₹1,50,000) would
     * be invisible on the Fees Payments page until each student's ledger was
     * touched manually — payments still show as PARTIAL of the old total.
     *
     * Concession is preserved per-ledger (admins may have granted waivers).
     * The earliest fee due-date wins.
     */
    private void refreshLedgersFor(String academicYearId, String classId) {
        if (academicYearId == null || classId == null) return;

        // 1) Recompute the canonical per-student fee from the current structures.
        List<FeeStructure> structures = structureRepo.findByAcademicYearIdAndClassId(academicYearId, classId);
        double perStudentFee = 0.0;
        java.time.LocalDate earliestDue = null;
        String firstStructureId = null;
        for (FeeStructure fs : structures) {
            perStudentFee += fs.getAmount();
            if (firstStructureId == null) firstStructureId = fs.getFeeStructureId();
            if (fs.getDueDate() != null
                    && (earliestDue == null || fs.getDueDate().isBefore(earliestDue))) {
                earliestDue = fs.getDueDate();
            }
        }

        // 2) Apply to every ledger for this (year, class).
        List<StudentFeeLedger> ledgers = ledgerRepo.findByClassIdAndAcademicYearId(classId, academicYearId);
        for (StudentFeeLedger ledger : ledgers) {
            ledger.setTotalFee(perStudentFee);
            if (firstStructureId != null) ledger.setFeeStructureId(firstStructureId);
            ledger.setDueDate(earliestDue);
            // recompute() reads totalFee + concession + payments to refresh
            // totalDue / totalPaid / balance / status atomically.
            ledgerService.recompute(ledger);
            ledgerRepo.save(ledger);
        }
    }

    public List<FeeStructure> listStructures(String academicYearId, String classId) {
        return classId != null
                ? structureRepo.findByAcademicYearIdAndClassId(academicYearId, classId)
                : structureRepo.findByAcademicYearId(academicYearId);
    }

    // ── Fee Payments ──────────────────────────────────────────────

    public FeePayment recordPayment(FeePayment req, String recordedBy) {
        req.setPaymentId(UUID.randomUUID().toString());
        req.setReceiptNumber(generateReceiptNumber());
        req.setRecordedBy(recordedBy);
        if (req.getPaymentDate() == null) req.setPaymentDate(LocalDate.now());
        FeePayment saved = paymentRepo.save(req);
        auditService.log("RECORD_PAYMENT", "FeePayment", saved.getPaymentId(),
                "Payment recorded for student " + req.getStudentId() + ": " + req.getAmountPaid());
        return saved;
    }

    public FeePayment updatePayment(String id, FeePayment req) {
        FeePayment existing = paymentRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
        if (req.getAmountPaid() > 0) existing.setAmountPaid(req.getAmountPaid());
        if (req.getPaymentMode() != null) existing.setPaymentMode(req.getPaymentMode());
        if (req.getPaymentStatus() != null) existing.setPaymentStatus(req.getPaymentStatus());
        if (req.getPaymentDate() != null) existing.setPaymentDate(req.getPaymentDate());
        if (req.getRemarks() != null) existing.setRemarks(req.getRemarks());
        return paymentRepo.save(existing);
    }

    public void deletePayment(String id) {
        paymentRepo.deleteById(id);
        auditService.log("DELETE_PAYMENT", "FeePayment", id, "Payment deleted");
    }

    public List<FeePayment> getStudentPayments(String studentId) {
        return paymentRepo.findByStudentId(studentId);
    }

    // ── Student Fee Summary ───────────────────────────────────────

    public Map<String, Object> getStudentFeeDetails(String studentId, String academicYearId) {
        // Get student to find classId
        Student student = studentRepo.findByStudentIdAndDeletedAtIsNull(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        // Get fee structure for this class + academic year
        List<FeeStructure> structures = structureRepo.findByAcademicYearIdAndClassId(
                academicYearId, student.getClassId());
        double totalFee = structures.stream().mapToDouble(FeeStructure::getAmount).sum();

        // Get all payments for this student + academic year
        List<FeePayment> payments = paymentRepo.findByStudentIdAndAcademicYearId(studentId, academicYearId);
        double totalPaid = payments.stream().mapToDouble(FeePayment::getAmountPaid).sum();

        double pending = totalFee - totalPaid;

        // Determine status
        String status;
        if (totalPaid >= totalFee && totalFee > 0) {
            status = "PAID";
        } else if (totalPaid > 0) {
            // Check if overdue
            boolean overdue = structures.stream()
                    .anyMatch(s -> s.getDueDate() != null && s.getDueDate().isBefore(LocalDate.now()));
            status = overdue ? "OVERDUE" : "PARTIAL";
        } else if (totalFee > 0) {
            boolean overdue = structures.stream()
                    .anyMatch(s -> s.getDueDate() != null && s.getDueDate().isBefore(LocalDate.now()));
            status = overdue ? "OVERDUE" : "UNPAID";
        } else {
            status = "NO_FEE";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("studentId", studentId);
        result.put("totalFee", totalFee);
        result.put("totalPaid", totalPaid);
        result.put("pending", Math.max(pending, 0));
        result.put("status", status);
        result.put("payments", payments);
        result.put("structures", structures);
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────

    private String generateReceiptNumber() {
        return "RCP-" + LocalDate.now().getYear() + "-" + String.format("%06d", (long) (Math.random() * 1000000));
    }
}
