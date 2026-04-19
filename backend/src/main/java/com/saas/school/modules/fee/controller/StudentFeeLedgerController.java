package com.saas.school.modules.fee.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.fee.dto.AppendPaymentRequest;
import com.saas.school.modules.fee.dto.UpdatePaymentRequest;
import com.saas.school.modules.fee.dto.VoidPaymentRequest;
import com.saas.school.modules.fee.model.StudentFeeLedger;
import com.saas.school.modules.fee.service.FeePaymentMigrationService;
import com.saas.school.modules.fee.service.StudentFeeLedgerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Fee Ledgers")
@RestController
@RequestMapping("/api/v1/fee-ledgers")
public class StudentFeeLedgerController {

    @Autowired
    private StudentFeeLedgerService service;

    @Autowired
    private FeePaymentMigrationService migrationService;

    /** Roster listing — one row per student with their running totals. */
    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<StudentFeeLedger>>> list(
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String sectionId,
            @RequestParam(required = false) StudentFeeLedger.Status status) {
        return ResponseEntity.ok(ApiResponse.success(service.list(academicYearId, classId, sectionId, status)));
    }

    /** Get (or create) the ledger for a student + year — used to open the detail pane. */
    @GetMapping("/for-student")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','PARENT')")
    public ResponseEntity<ApiResponse<StudentFeeLedger>> forStudent(
            @RequestParam String studentId,
            @RequestParam String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(service.getOrCreate(studentId, academicYearId)));
    }

    @GetMapping("/{ledgerId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','PARENT')")
    public ResponseEntity<ApiResponse<StudentFeeLedger>> getOne(@PathVariable String ledgerId) {
        return ResponseEntity.ok(ApiResponse.success(service.getById(ledgerId)));
    }

    /** Append a new payment to the ledger's embedded array. */
    @PostMapping("/{ledgerId}/payments")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentFeeLedger>> appendPayment(
            @PathVariable String ledgerId,
            @RequestBody AppendPaymentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.appendPayment(ledgerId, req, userId),
                "Payment recorded"));
    }

    /** Edit a payment (correction). Supersedes the original — never overwrites. */
    @PutMapping("/{ledgerId}/payments/{paymentId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentFeeLedger>> updatePayment(
            @PathVariable String ledgerId,
            @PathVariable String paymentId,
            @RequestBody UpdatePaymentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.updatePayment(ledgerId, paymentId, req, userId),
                "Payment corrected"));
    }

    /** Void a payment — keeps it visible but marks it voided and recomputes totals. */
    @PostMapping("/{ledgerId}/payments/{paymentId}/void")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentFeeLedger>> voidPayment(
            @PathVariable String ledgerId,
            @PathVariable String paymentId,
            @RequestBody(required = false) VoidPaymentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.voidPayment(ledgerId, paymentId, req, userId),
                "Payment voided"));
    }

    @DeleteMapping("/{ledgerId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteLedger(@PathVariable String ledgerId) {
        service.deleteLedger(ledgerId);
        return ResponseEntity.ok(ApiResponse.success(null, "Ledger deleted"));
    }

    /** One-shot (idempotent) migration from the legacy fee_payments collection. */
    @PostMapping("/migrate-legacy")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<FeePaymentMigrationService.MigrationResult>> migrateLegacy() {
        FeePaymentMigrationService.MigrationResult result = migrationService.runForCurrentTenant();
        return ResponseEntity.ok(ApiResponse.success(result,
                "Migrated " + result.migratedLedgers + " ledger(s) from "
                + result.legacyCount + " legacy row(s)"));
    }
}
