package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.RegularizationRequestDto;
import com.saas.school.modules.hr.dto.RegularizationReviewRequest;
import com.saas.school.modules.hr.dto.SubmitRegularizationRequest;
import com.saas.school.modules.hr.service.RegularizationService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Regularization endpoints — one workflow with two audiences.
 * Employees submit + view their own; HR reviews everyone's.
 *
 * <p>Employee endpoints intentionally have no role gate — every
 * authenticated user who's linked to a Teacher record can submit.
 * HR endpoints carry the class-level {@code @PreAuthorize} guard
 * further down.</p>
 */
@RestController
@RequestMapping("/api/v1/hr/attendance/regularization")
public class RegularizationController {

    @Autowired private RegularizationService service;

    // ── Employee-facing ─────────────────────────────────────────

    @Operation(summary = "Submit a regularization request for the caller's own attendance")
    @PostMapping("/request")
    public ResponseEntity<ApiResponse<RegularizationRequestDto>> submit(
            @AuthenticationPrincipal String userId,
            @RequestBody SubmitRegularizationRequest req) {
        RegularizationRequestDto res = service.submit(userId, req);
        String msg = "AUTO_APPROVED".equals(res.getStatus())
            ? "Auto-approved — your attendance has been updated."
            : "Request submitted. HR will review it shortly.";
        return ResponseEntity.ok(ApiResponse.success(res, msg));
    }

    @Operation(summary = "The caller's own regularization request history")
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<RegularizationRequestDto>>> myRequests(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.listMy(userId)));
    }

    // ── HR-facing ───────────────────────────────────────────────

    @Operation(summary = "Pending regularization requests waiting for HR review")
    @GetMapping("/pending")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<RegularizationRequestDto>>> pending() {
        return ResponseEntity.ok(ApiResponse.success(service.listPending()));
    }

    @Operation(summary = "Reviewed request history — approved, auto-approved, or rejected")
    @GetMapping("/history")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<RegularizationRequestDto>>> history() {
        return ResponseEntity.ok(ApiResponse.success(service.listHistory()));
    }

    @Operation(summary = "HR approves a pending regularization — writes the attendance row")
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<RegularizationRequestDto>> approve(
            @PathVariable String id,
            @AuthenticationPrincipal String userId,
            @RequestBody(required = false) RegularizationReviewRequest review) {
        return ResponseEntity.ok(ApiResponse.success(service.approve(id, userId, review),
            "Request approved. Attendance updated."));
    }

    @Operation(summary = "HR rejects a pending regularization with a note")
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<RegularizationRequestDto>> reject(
            @PathVariable String id,
            @AuthenticationPrincipal String userId,
            @RequestBody(required = false) RegularizationReviewRequest review) {
        return ResponseEntity.ok(ApiResponse.success(service.reject(id, userId, review),
            "Request rejected."));
    }
}
