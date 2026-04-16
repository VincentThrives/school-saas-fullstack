package com.saas.school.modules.fee.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.fee.model.*;
import com.saas.school.modules.fee.service.FeeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Fees")
@RestController
@RequestMapping("/api/v1/fees")
public class FeeController {
    @Autowired private FeeService feeService;

    // ── Fee Structures ────────────────────────────────────────────

    @GetMapping("/structures")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','PARENT')")
    public ResponseEntity<ApiResponse<List<FeeStructure>>> listStructures(
            @RequestParam String academicYearId,
            @RequestParam(required = false) String classId) {
        return ResponseEntity.ok(ApiResponse.success(feeService.listStructures(academicYearId, classId)));
    }

    @PostMapping("/structures")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<FeeStructure>> createStructure(@RequestBody FeeStructure req) {
        return ResponseEntity.ok(ApiResponse.success(feeService.createStructure(req), "Created"));
    }

    @PutMapping("/structures/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<FeeStructure>> updateStructure(
            @PathVariable String id, @RequestBody FeeStructure req) {
        return ResponseEntity.ok(ApiResponse.success(feeService.updateStructure(id, req), "Updated"));
    }

    @DeleteMapping("/structures/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteStructure(@PathVariable String id) {
        feeService.deleteStructure(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }

    // ── Fee Payments ──────────────────────────────────────────────

    @PostMapping("/payments")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<FeePayment>> recordPayment(
            @RequestBody FeePayment req, @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(feeService.recordPayment(req, userId), "Payment recorded"));
    }

    @PutMapping("/payments/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<FeePayment>> updatePayment(
            @PathVariable String id, @RequestBody FeePayment req) {
        return ResponseEntity.ok(ApiResponse.success(feeService.updatePayment(id, req), "Payment updated"));
    }

    @DeleteMapping("/payments/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePayment(@PathVariable String id) {
        feeService.deletePayment(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Payment deleted"));
    }

    @GetMapping("/payments/student/{studentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','PARENT')")
    public ResponseEntity<ApiResponse<List<FeePayment>>> studentPayments(@PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(feeService.getStudentPayments(studentId)));
    }

    // ── Student Fee Summary ───────────────────────────────────────

    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','PARENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> studentFeeDetails(
            @PathVariable String studentId,
            @RequestParam String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(feeService.getStudentFeeDetails(studentId, academicYearId)));
    }
}
