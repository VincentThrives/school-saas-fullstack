package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.LeaveApplicationDto;
import com.saas.school.modules.hr.dto.LeaveBalanceDto;
import com.saas.school.modules.hr.dto.LeaveReviewRequest;
import com.saas.school.modules.hr.dto.LeaveTypeDto;
import com.saas.school.modules.hr.dto.SubmitLeaveRequest;
import com.saas.school.modules.hr.service.LeaveService;
import com.saas.school.modules.hr.service.LeaveTypeService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Leave endpoints — one workflow with two audiences, same pattern as
 * {@code RegularizationController}: employee endpoints are open to
 * any authenticated Teacher-linked user, HR endpoints are role-gated.
 */
@RestController
@RequestMapping("/api/v1/hr/leave")
public class LeaveController {

    @Autowired private LeaveService service;
    @Autowired private LeaveTypeService typeService;

    // ── Employee-facing ────────────────────────────────────────

    @Operation(summary = "Apply for leave")
    @PostMapping("/apply")
    public ResponseEntity<ApiResponse<LeaveApplicationDto>> apply(
            @AuthenticationPrincipal String userId,
            @RequestBody SubmitLeaveRequest req) {
        LeaveApplicationDto res = service.submit(userId, req);
        return ResponseEntity.ok(ApiResponse.success(res,
            "Leave submitted. HR will review it shortly."));
    }

    @Operation(summary = "The caller's own leave history")
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<LeaveApplicationDto>>> myLeaves(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.listMy(userId)));
    }

    @Operation(summary = "The caller's leave balance for a given year (defaults to current)")
    @GetMapping("/my/balance")
    public ResponseEntity<ApiResponse<List<LeaveBalanceDto>>> myBalance(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now(ZoneId.of("Asia/Kolkata")).getYear();
        return ResponseEntity.ok(ApiResponse.success(service.getBalanceForUser(userId, y)));
    }

    /**
     * Mounted at {@code /active-types} rather than {@code /types/active}
     * because the FeatureFlagFilter uses startsWith prefix matching —
     * putting it under {@code /types/*} would sub-gate it behind the
     * HR-only {@code hr_leave} flag, blocking employees from loading
     * the dropdown on schools whose HR staff had that flag off.
     */
    @Operation(summary = "Active leave types — dropdown source for the Apply Leave dialog")
    @GetMapping("/active-types")
    public ResponseEntity<ApiResponse<List<LeaveTypeDto>>> activeTypes() {
        return ResponseEntity.ok(ApiResponse.success(typeService.listActive()));
    }

    @Operation(summary = "Cancel a leave the caller submitted")
    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<LeaveApplicationDto>> cancel(
            @AuthenticationPrincipal String userId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.cancel(id, userId),
            "Leave cancelled."));
    }

    // ── HR-facing ──────────────────────────────────────────────

    @Operation(summary = "Pending leave applications waiting for HR review")
    @GetMapping("/pending")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<LeaveApplicationDto>>> pending() {
        return ResponseEntity.ok(ApiResponse.success(service.listPending()));
    }

    @Operation(summary = "Reviewed leave history — approved, rejected, cancelled")
    @GetMapping("/history")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<LeaveApplicationDto>>> history() {
        return ResponseEntity.ok(ApiResponse.success(service.listHistory()));
    }

    @Operation(summary = "HR approves a pending leave — writes ON_LEAVE attendance rows")
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<LeaveApplicationDto>> approve(
            @PathVariable String id,
            @AuthenticationPrincipal String userId,
            @RequestBody(required = false) LeaveReviewRequest review) {
        return ResponseEntity.ok(ApiResponse.success(service.approve(id, userId, review),
            "Leave approved. Attendance updated."));
    }

    @Operation(summary = "HR rejects a pending leave with a note")
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<LeaveApplicationDto>> reject(
            @PathVariable String id,
            @AuthenticationPrincipal String userId,
            @RequestBody(required = false) LeaveReviewRequest review) {
        return ResponseEntity.ok(ApiResponse.success(service.reject(id, userId, review),
            "Leave rejected."));
    }

    @Operation(summary = "HR view: any employee's leave balance for a year")
    @GetMapping("/employees/{employeeId}/balance")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<LeaveBalanceDto>>> employeeBalance(
            @PathVariable String employeeId,
            @RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now(ZoneId.of("Asia/Kolkata")).getYear();
        return ResponseEntity.ok(ApiResponse.success(service.getBalanceForEmployee(employeeId, y)));
    }
}
