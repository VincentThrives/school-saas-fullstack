package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.UpdateAttendanceSettingsRequest;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.service.EmployeeAttendanceSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Full HR settings view — location config, punch rules, thresholds,
 * regularization policy. HR role only. Employees fetch a filtered
 * subset via {@code HrAttendanceController.publicSettings} which
 * strips admin-only fields (monthly caps, auto-approve minutes, etc).
 */
@Tag(name = "HR Attendance Settings")
@RestController
@RequestMapping("/api/v1/hr/attendance/settings")
@PreAuthorize("hasRole('HR')")
public class HrAttendanceSettingsController {

    @Autowired private EmployeeAttendanceSettingsService service;

    @Operation(summary = "Read the full attendance settings (HR only)")
    @GetMapping
    public ResponseEntity<ApiResponse<EmployeeAttendanceSettings>> get() {
        return ResponseEntity.ok(ApiResponse.success(service.getOrCreate()));
    }

    @Operation(summary = "Patch the attendance settings (HR only) — "
            + "only non-null fields on the request are written.")
    @PutMapping
    public ResponseEntity<ApiResponse<EmployeeAttendanceSettings>> update(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UpdateAttendanceSettingsRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
                service.update(req, userId), "Attendance settings saved"));
    }
}
