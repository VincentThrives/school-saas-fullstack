package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.HrBindingUpsertRequest;
import com.saas.school.modules.hr.dto.HrEmployeeTerminalBindingDto;
import com.saas.school.modules.hr.dto.HrTerminalDto;
import com.saas.school.modules.hr.dto.HrTerminalPunchDto;
import com.saas.school.modules.hr.dto.HrUnboundEmployeeDto;
import com.saas.school.modules.hr.service.HrTerminalBindingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * HR-only Employee ↔ Terminal binding CRUD. Sits under the HR
 * attendance namespace so the sidebar + route guard already gate it
 * to HR users. The class-level {@code @PreAuthorize} is defence in
 * depth for direct API hits.
 *
 * <p>Terminals themselves are registered from the admin-side terminals
 * page — this controller only lists them so bindings can pick a
 * device, it doesn't create or delete them.</p>
 */
@RestController
@RequestMapping("/api/v1/hr/attendance/bindings")
@PreAuthorize("hasRole('HR')")
public class HrTerminalBindingController {

    @Autowired private HrTerminalBindingService service;

    /** Terminals available for binding — same list as the admin
     *  terminals page but slimmer (no scan counts / last-punch). */
    @GetMapping("/terminals")
    public ResponseEntity<ApiResponse<List<HrTerminalDto>>> listTerminals() {
        return ResponseEntity.ok(ApiResponse.success(service.listTerminals()));
    }

    /** All employee bindings on one terminal. */
    @GetMapping("/terminals/{serial}")
    public ResponseEntity<ApiResponse<List<HrEmployeeTerminalBindingDto>>> listBindings(
            @PathVariable String serial) {
        return ResponseEntity.ok(ApiResponse.success(service.listBindings(serial)));
    }

    /** Employees who aren't bound anywhere — drives the "Add binding"
     *  employee dropdown so HR only picks from staff who need
     *  enrolment. */
    @GetMapping("/unbound-employees")
    public ResponseEntity<ApiResponse<List<HrUnboundEmployeeDto>>> unboundEmployees() {
        return ResponseEntity.ok(ApiResponse.success(service.getUnboundEmployees()));
    }

    /** Create a new binding. 409-ish (BusinessException 400) if the
     *  terminal user id is already taken by another employee. */
    @PostMapping("/terminals/{serial}")
    public ResponseEntity<ApiResponse<HrEmployeeTerminalBindingDto>> createBinding(
            @PathVariable String serial,
            @RequestBody HrBindingUpsertRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
            service.createBinding(serial, req, userId)));
    }

    /** Update the terminal user id on an existing binding — for
     *  re-enrolment on the device that produced a new slot number. */
    @PutMapping("/terminals/{serial}/uid/{currentTerminalUserId}")
    public ResponseEntity<ApiResponse<HrEmployeeTerminalBindingDto>> updateBinding(
            @PathVariable String serial,
            @PathVariable String currentTerminalUserId,
            @RequestBody HrBindingUpsertRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
            service.updateBinding(serial, currentTerminalUserId, req, userId)));
    }

    /** Remove a binding. Idempotent — a missing row is treated as
     *  already-deleted so double-clicks in the UI don't 404. */
    @DeleteMapping("/terminals/{serial}/uid/{terminalUserId}")
    public ResponseEntity<ApiResponse<Void>> deleteBinding(
            @PathVariable String serial,
            @PathVariable String terminalUserId) {
        service.deleteBinding(serial, terminalUserId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Employees who punched this terminal on the given date. Drives
     *  the HR bindings page's "Punches on this terminal" panel.
     *  Date defaults to today (Asia/Kolkata) when omitted so the
     *  endpoint is safe to hit on first page load. */
    @GetMapping("/terminals/{serial}/punches")
    public ResponseEntity<ApiResponse<List<HrTerminalPunchDto>>> getTerminalPunches(
            @PathVariable String serial,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(
            service.getTerminalPunches(serial, date)));
    }
}
