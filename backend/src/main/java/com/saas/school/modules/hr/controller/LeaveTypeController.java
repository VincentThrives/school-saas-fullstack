package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.LeaveTypeDto;
import com.saas.school.modules.hr.dto.UpsertLeaveTypeRequest;
import com.saas.school.modules.hr.service.LeaveTypeService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HR-only CRUD for leave types. Employee-facing "list active types
 * for the dropdown" lives on {@link LeaveController#activeTypes()}
 * so employees don't need HR to fetch the dropdown source.
 */
@RestController
@RequestMapping("/api/v1/hr/leave/types")
@PreAuthorize("hasRole('HR')")
public class LeaveTypeController {

    @Autowired private LeaveTypeService service;

    @Operation(summary = "All leave types — active + inactive")
    @GetMapping
    public ResponseEntity<ApiResponse<List<LeaveTypeDto>>> list() {
        return ResponseEntity.ok(ApiResponse.success(service.listAll()));
    }

    @Operation(summary = "Create a new leave type")
    @PostMapping
    public ResponseEntity<ApiResponse<LeaveTypeDto>> create(@RequestBody UpsertLeaveTypeRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Leave type created."));
    }

    @Operation(summary = "Update a leave type — code is immutable")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<LeaveTypeDto>> update(
            @PathVariable String id, @RequestBody UpsertLeaveTypeRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, req), "Leave type updated."));
    }

    @Operation(summary = "Toggle the active flag — hides / shows the type from Apply Leave")
    @PostMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<LeaveTypeDto>> toggle(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.toggleActive(id)));
    }
}
