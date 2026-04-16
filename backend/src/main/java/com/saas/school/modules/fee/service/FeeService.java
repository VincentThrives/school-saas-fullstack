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

    // ── Fee Structures ────────────────────────────────────────────

    public FeeStructure createStructure(FeeStructure req) {
        req.setFeeStructureId(UUID.randomUUID().toString());
        return structureRepo.save(req);
    }

    public FeeStructure updateStructure(String id, FeeStructure req) {
        FeeStructure existing = structureRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fee structure not found"));
        if (req.getAmount() > 0) existing.setAmount(req.getAmount());
        if (req.getDueDate() != null) existing.setDueDate(req.getDueDate());
        if (req.getDescription() != null) existing.setDescription(req.getDescription());
        if (req.getFeeType() != null) existing.setFeeType(req.getFeeType());
        return structureRepo.save(existing);
    }

    public void deleteStructure(String id) {
        structureRepo.deleteById(id);
        auditService.log("DELETE_FEE_STRUCTURE", "FeeStructure", id, "Fee structure deleted");
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
