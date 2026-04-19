package com.saas.school.modules.fee.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.fee.dto.AppendPaymentRequest;
import com.saas.school.modules.fee.dto.UpdatePaymentRequest;
import com.saas.school.modules.fee.dto.VoidPaymentRequest;
import com.saas.school.modules.fee.model.FeeStructure;
import com.saas.school.modules.fee.model.StudentFeeLedger;
import com.saas.school.modules.fee.model.StudentFeeLedger.Payment;
import com.saas.school.modules.fee.model.StudentFeeLedger.PaymentCorrection;
import com.saas.school.modules.fee.model.StudentFeeLedger.Status;
import com.saas.school.modules.fee.repository.FeeStructureRepository;
import com.saas.school.modules.fee.repository.StudentFeeLedgerRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * All reads/writes against the {@link StudentFeeLedger} collection go through
 * this service. One document per (student, academic year); payments are
 * appended to the embedded array, never split across documents.
 */
@Service
public class StudentFeeLedgerService {

    private static final Logger logger = LoggerFactory.getLogger(StudentFeeLedgerService.class);

    @Autowired private StudentFeeLedgerRepository ledgerRepo;
    @Autowired private FeeStructureRepository feeStructureRepo;
    @Autowired private StudentRepository studentRepo;
    @Autowired private SchoolClassRepository schoolClassRepo;
    @Autowired private AcademicYearRepository academicYearRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private FeeReceiptCounterService receiptCounter;
    @Autowired private AuditService auditService;

    // ── Reads ────────────────────────────────────────────────────────

    public List<StudentFeeLedger> list(String academicYearId, String classId, String sectionId,
                                       Status status) {
        List<StudentFeeLedger> list;
        if (classId != null && sectionId != null && academicYearId != null) {
            list = ledgerRepo.findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId);
        } else if (classId != null && academicYearId != null) {
            list = ledgerRepo.findByClassIdAndAcademicYearId(classId, academicYearId);
        } else if (academicYearId != null && status != null) {
            list = ledgerRepo.findByAcademicYearIdAndStatus(academicYearId, status);
        } else if (academicYearId != null) {
            list = ledgerRepo.findByAcademicYearId(academicYearId);
        } else {
            list = ledgerRepo.findAll();
        }
        if (status != null) {
            list.removeIf(l -> l.getStatus() != status);
        }
        return list;
    }

    public StudentFeeLedger getById(String ledgerId) {
        return ledgerRepo.findById(ledgerId)
                .orElseThrow(() -> new ResourceNotFoundException("Ledger not found: " + ledgerId));
    }

    /** Get or create (empty ledger) for a given student+year, seeding totals from the FeeStructure. */
    public StudentFeeLedger getOrCreate(String studentId, String academicYearId) {
        return ledgerRepo.findByStudentIdAndAcademicYearId(studentId, academicYearId)
                .orElseGet(() -> createEmpty(studentId, academicYearId));
    }

    // ── Writes: append / update / void ───────────────────────────────

    public StudentFeeLedger appendPayment(String ledgerId, AppendPaymentRequest req, String userId) {
        if (req.getAmount() <= 0) throw new IllegalArgumentException("Amount must be positive");

        return retryOnConflict(() -> {
            StudentFeeLedger ledger = getById(ledgerId);
            double remaining = ledger.getBalance();
            if (req.getAmount() > remaining + 0.0001) {
                throw new IllegalArgumentException(
                        "Payment amount (" + req.getAmount() + ") exceeds remaining balance ("
                        + remaining + ") for fee structure total " + ledger.getTotalDue());
            }
            Payment p = buildPayment(ledger, req.getAmount(), req.getMode(), req.getPaidAt(), req.getNotes(), userId);
            p.setCreatedAt(Instant.now());
            ledger.getPayments().add(p);
            ledger.getCorrections().add(audit(p.getPaymentId(), "APPEND", null, userId));
            recompute(ledger);
            StudentFeeLedger saved = ledgerRepo.save(ledger);
            auditService.log("FEE_PAYMENT_APPEND", "StudentFeeLedger", saved.getLedgerId(),
                    "Appended payment " + p.getReceiptNumber() + " of " + req.getAmount());
            return saved;
        });
    }

    public StudentFeeLedger updatePayment(String ledgerId, String paymentId, UpdatePaymentRequest req, String userId) {
        if (req.getAmount() <= 0) throw new IllegalArgumentException("Amount must be positive");

        return retryOnConflict(() -> {
            StudentFeeLedger ledger = getById(ledgerId);
            Payment existing = findActivePayment(ledger, paymentId);
            // Would-be totalPaid if this correction were applied = current - existing + new
            double projectedTotal = ledger.getTotalPaid() - existing.getAmount() + req.getAmount();
            if (projectedTotal > ledger.getTotalDue() + 0.0001) {
                throw new IllegalArgumentException(
                        "Corrected amount (" + req.getAmount() + ") would push total paid ("
                        + projectedTotal + ") above the fee structure total (" + ledger.getTotalDue() + ")");
            }
            // Supersede the existing entry and append a corrected one (audit-preserving).
            existing.setVoidedAt(Instant.now());
            existing.setVoidedByUserId(userId);
            existing.setVoidReason("Superseded by correction: " + (req.getReason() == null ? "(no reason)" : req.getReason()));

            Payment correction = buildPayment(ledger, req.getAmount(), req.getMode(),
                    req.getPaidAt() == null ? existing.getPaidAt() : req.getPaidAt(),
                    req.getNotes(), userId);
            correction.setSupersededPaymentId(existing.getPaymentId());
            correction.setCreatedAt(Instant.now());
            ledger.getPayments().add(correction);
            ledger.getCorrections().add(audit(correction.getPaymentId(), "EDIT", req.getReason(), userId));
            recompute(ledger);

            StudentFeeLedger saved = ledgerRepo.save(ledger);
            auditService.log("FEE_PAYMENT_EDIT", "StudentFeeLedger", saved.getLedgerId(),
                    "Edited payment " + paymentId + " via correction " + correction.getReceiptNumber());
            return saved;
        });
    }

    public StudentFeeLedger voidPayment(String ledgerId, String paymentId, VoidPaymentRequest req, String userId) {
        return retryOnConflict(() -> {
            StudentFeeLedger ledger = getById(ledgerId);
            Payment existing = findActivePayment(ledger, paymentId);
            existing.setVoidedAt(Instant.now());
            existing.setVoidedByUserId(userId);
            existing.setVoidReason(req == null ? null : req.getReason());
            ledger.getCorrections().add(audit(paymentId, "VOID", req == null ? null : req.getReason(), userId));
            recompute(ledger);
            StudentFeeLedger saved = ledgerRepo.save(ledger);
            auditService.log("FEE_PAYMENT_VOID", "StudentFeeLedger", saved.getLedgerId(),
                    "Voided payment " + paymentId);
            return saved;
        });
    }

    public void deleteLedger(String ledgerId) {
        if (!ledgerRepo.existsById(ledgerId)) {
            throw new ResourceNotFoundException("Ledger not found: " + ledgerId);
        }
        ledgerRepo.deleteById(ledgerId);
        auditService.log("FEE_LEDGER_DELETE", "StudentFeeLedger", ledgerId, "Deleted ledger");
    }

    // ── Internals ────────────────────────────────────────────────────

    /** Seeds a fresh ledger with class / section / AY / fee structure snapshots. */
    private StudentFeeLedger createEmpty(String studentId, String academicYearId) {
        Student student = studentRepo.findByStudentIdAndDeletedAtIsNull(studentId).orElse(null);
        StudentFeeLedger l = new StudentFeeLedger();
        l.setLedgerId(UUID.randomUUID().toString());
        l.setStudentId(studentId);
        l.setAcademicYearId(academicYearId);

        if (student != null) {
            l.setAdmissionNumber(student.getAdmissionNumber());
            l.setRollNumber(student.getRollNumber());
            l.setClassId(student.getClassId());
            l.setSectionId(student.getSectionId());
            l.setStudentName(buildStudentName(student));
        }

        // Pull fee structure (match class+year).
        if (student != null && student.getClassId() != null && academicYearId != null) {
            List<FeeStructure> structures = feeStructureRepo.findByAcademicYearIdAndClassId(academicYearId, student.getClassId());
            double total = 0;
            String feeStructureId = null;
            LocalDate dueDate = null;
            for (FeeStructure fs : structures) {
                total += fs.getAmount();
                if (feeStructureId == null) feeStructureId = fs.getFeeStructureId();
                if (dueDate == null || (fs.getDueDate() != null && fs.getDueDate().isBefore(dueDate))) {
                    dueDate = fs.getDueDate();
                }
            }
            l.setTotalFee(total);
            l.setFeeStructureId(feeStructureId);
            l.setDueDate(dueDate);
        }

        // Class / section names
        if (l.getClassId() != null) {
            SchoolClass cls = schoolClassRepo.findById(l.getClassId()).orElse(null);
            if (cls != null) {
                l.setClassName(cls.getName());
                if (l.getSectionId() != null && cls.getSections() != null) {
                    cls.getSections().stream()
                            .filter(s -> l.getSectionId().equals(s.getSectionId()))
                            .findFirst()
                            .ifPresent(s -> l.setSectionName(s.getName()));
                }
            }
        }

        // Academic year label
        if (academicYearId != null) {
            academicYearRepo.findById(academicYearId).ifPresent(ay -> l.setAcademicYearLabel(ay.getLabel()));
        }

        l.setTotalDue(l.getTotalFee() - l.getConcession());
        l.setTotalPaid(0);
        l.setBalance(l.getTotalDue());
        l.setStatus(l.getTotalDue() > 0 ? Status.UNPAID : Status.PAID);
        return ledgerRepo.save(l);
    }

    private String buildStudentName(Student student) {
        String first = student.getFirstName() == null ? "" : student.getFirstName();
        String last = student.getLastName() == null ? "" : student.getLastName();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        // Fall back to the linked User record.
        if (student.getUserId() != null) {
            User u = userRepo.findById(student.getUserId()).orElse(null);
            if (u != null) return ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                    + (u.getLastName() == null ? "" : u.getLastName())).trim();
        }
        return student.getAdmissionNumber();
    }

    private Payment buildPayment(StudentFeeLedger ledger, double amount,
                                  StudentFeeLedger.PaymentMode mode, LocalDate paidAt,
                                  String notes, String userId) {
        Payment p = new Payment();
        p.setPaymentId(UUID.randomUUID().toString());
        p.setReceiptNumber(receiptCounter.nextReceiptNumber(ledger.getAcademicYearLabel(), ledger.getAcademicYearId()));
        p.setAmount(amount);
        p.setMode(mode == null ? StudentFeeLedger.PaymentMode.CASH : mode);
        p.setPaidAt(paidAt == null ? LocalDate.now() : paidAt);
        p.setNotes(notes);
        p.setCollectedByUserId(userId);
        if (userId != null) {
            userRepo.findById(userId).ifPresent(u -> p.setCollectedByName(
                    ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                    + (u.getLastName() == null ? "" : u.getLastName())).trim()));
        }
        return p;
    }

    private Payment findActivePayment(StudentFeeLedger ledger, String paymentId) {
        return ledger.getPayments().stream()
                .filter(p -> paymentId.equals(p.getPaymentId()) && !p.isVoided())
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Active payment not found: " + paymentId + " on ledger " + ledger.getLedgerId()));
    }

    /** Recomputes totalPaid / balance / status from the payments array. */
    public void recompute(StudentFeeLedger ledger) {
        double totalPaid = 0;
        for (Payment p : ledger.getPayments()) {
            if (!p.isVoided()) totalPaid += p.getAmount();
        }
        double totalDue = ledger.getTotalFee() - ledger.getConcession();
        ledger.setTotalDue(totalDue);
        ledger.setTotalPaid(totalPaid);
        ledger.setBalance(totalDue - totalPaid);

        Status newStatus;
        if (totalDue <= 0 || totalPaid >= totalDue) newStatus = Status.PAID;
        else if (totalPaid > 0) newStatus = Status.PARTIAL;
        else newStatus = Status.UNPAID;

        if (newStatus != Status.PAID
                && ledger.getDueDate() != null
                && LocalDate.now().isAfter(ledger.getDueDate())
                && ledger.getBalance() > 0) {
            newStatus = Status.OVERDUE;
        }
        ledger.setStatus(newStatus);
    }

    private PaymentCorrection audit(String paymentId, String action, String reason, String userId) {
        PaymentCorrection c = new PaymentCorrection();
        c.setCorrectionId(UUID.randomUUID().toString());
        c.setPaymentId(paymentId);
        c.setAction(action);
        c.setReason(reason);
        c.setByUserId(userId);
        c.setAt(Instant.now());
        return c;
    }

    /** Retry once on optimistic locking conflict. */
    private <T> T retryOnConflict(java.util.function.Supplier<T> op) {
        try {
            return op.get();
        } catch (OptimisticLockingFailureException ex) {
            logger.warn("Optimistic lock conflict on ledger write — retrying once");
            return op.get();
        }
    }
}
