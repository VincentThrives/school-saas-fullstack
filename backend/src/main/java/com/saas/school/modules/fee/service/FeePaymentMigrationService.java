package com.saas.school.modules.fee.service;

import com.saas.school.modules.fee.model.FeePayment;
import com.saas.school.modules.fee.model.StudentFeeLedger;
import com.saas.school.modules.fee.repository.FeePaymentRepository;
import com.saas.school.modules.fee.repository.StudentFeeLedgerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/**
 * One-shot (idempotent) migration from the legacy flat {@code fee_payments}
 * collection into {@link StudentFeeLedger} rows (one per student+year).
 *
 * Safe to call from a controller endpoint or at boot. Re-running once the new
 * collection has data is a no-op for any (student, year) that already has a
 * ledger.
 */
@Service
public class FeePaymentMigrationService {

    private static final Logger logger = LoggerFactory.getLogger(FeePaymentMigrationService.class);

    @Autowired private FeePaymentRepository legacyRepo;
    @Autowired private StudentFeeLedgerRepository ledgerRepo;
    @Autowired private StudentFeeLedgerService ledgerService;

    public MigrationResult runForCurrentTenant() {
        MigrationResult result = new MigrationResult();
        List<FeePayment> legacy = legacyRepo.findAll();
        result.legacyCount = legacy.size();

        // Group by (studentId, academicYearId).
        Map<String, List<FeePayment>> grouped = new HashMap<>();
        for (FeePayment fp : legacy) {
            if (fp.getStudentId() == null || fp.getAcademicYearId() == null) continue;
            String key = fp.getStudentId() + "::" + fp.getAcademicYearId();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(fp);
        }

        for (Map.Entry<String, List<FeePayment>> entry : grouped.entrySet()) {
            String[] parts = entry.getKey().split("::", 2);
            String studentId = parts[0];
            String academicYearId = parts[1];

            if (ledgerRepo.findByStudentIdAndAcademicYearId(studentId, academicYearId).isPresent()) {
                result.skipped++;
                continue;
            }

            StudentFeeLedger ledger = ledgerService.getOrCreate(studentId, academicYearId);
            // getOrCreate already persisted an empty ledger with seeded totals.
            for (FeePayment fp : entry.getValue()) {
                StudentFeeLedger.Payment p = new StudentFeeLedger.Payment();
                p.setPaymentId(fp.getPaymentId() != null ? fp.getPaymentId() : UUID.randomUUID().toString());
                p.setReceiptNumber(fp.getReceiptNumber());
                p.setAmount(fp.getAmountPaid());
                p.setMode(mapMode(fp.getPaymentMode()));
                p.setPaidAt(fp.getPaymentDate() == null ? LocalDate.now() : fp.getPaymentDate());
                p.setNotes(fp.getRemarks());
                p.setCollectedByUserId(fp.getRecordedBy());
                p.setCreatedAt(fp.getCreatedAt() == null ? Instant.now() : fp.getCreatedAt());
                ledger.getPayments().add(p);
            }
            ledgerService.recompute(ledger);
            ledgerRepo.save(ledger);
            result.migratedLedgers++;
            result.migratedPayments += entry.getValue().size();
        }

        logger.info("Fee migration summary: legacyCount={} groups={} migratedLedgers={} migratedPayments={} skipped={}",
                result.legacyCount, grouped.size(), result.migratedLedgers, result.migratedPayments, result.skipped);
        return result;
    }

    private StudentFeeLedger.PaymentMode mapMode(FeePayment.PaymentMode old) {
        if (old == null) return StudentFeeLedger.PaymentMode.CASH;
        switch (old) {
            case CASH: return StudentFeeLedger.PaymentMode.CASH;
            case ONLINE: return StudentFeeLedger.PaymentMode.ONLINE;
            case CHEQUE: return StudentFeeLedger.PaymentMode.CHEQUE;
            case DD: return StudentFeeLedger.PaymentMode.DD;
            default: return StudentFeeLedger.PaymentMode.OTHER;
        }
    }

    public static class MigrationResult {
        public int legacyCount;
        public int migratedLedgers;
        public int migratedPayments;
        public int skipped;

        public int getLegacyCount() { return legacyCount; }
        public int getMigratedLedgers() { return migratedLedgers; }
        public int getMigratedPayments() { return migratedPayments; }
        public int getSkipped() { return skipped; }
    }
}
