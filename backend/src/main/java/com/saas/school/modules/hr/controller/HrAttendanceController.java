package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.ManualMarkRequest;
import com.saas.school.modules.hr.dto.MarkSelfAttendanceRequest;
import com.saas.school.modules.hr.dto.MarkSelfResponse;
import com.saas.school.modules.hr.dto.PublicAttendanceSettingsDto;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.service.EmployeeAttendanceService;
import com.saas.school.modules.hr.service.EmployeeAttendanceSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Employee-attendance endpoints. Two access tiers:
 *
 * <ul>
 *   <li><b>Employee-facing</b> — {@code /mark-self}, {@code /my},
 *       {@code /settings/public} — reachable by any authenticated
 *       user with a linked Teacher record. Deliberately NOT gated
 *       by the HR role because teachers, principals, coordinators
 *       etc all need to punch in.</li>
 *   <li><b>HR-facing</b> — {@code /daily}, {@code /monthly/{employeeId}},
 *       {@code /mark-manual} — gated to the HR role only. Admins
 *       who also want HR access are expected to be granted the HR
 *       role via the multi-role assignment.</li>
 * </ul>
 */
@Tag(name = "HR Attendance")
@RestController
@RequestMapping("/api/v1/hr/attendance")
public class HrAttendanceController {

    @Autowired private EmployeeAttendanceService attendanceService;
    @Autowired private EmployeeAttendanceSettingsService settingsService;

    // ── Employee-facing ──────────────────────────────────────

    @Operation(summary = "Mark my own attendance via location (any employee)")
    @PostMapping("/mark-self")
    public ResponseEntity<ApiResponse<MarkSelfResponse>> markSelf(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody MarkSelfAttendanceRequest req) {
        MarkSelfResponse res = attendanceService.markSelf(userId, req);
        String direction = res.getPunchDirection();
        String message = "IN".equals(direction) ? "Marked IN" : "Marked OUT";
        return ResponseEntity.ok(ApiResponse.success(res, message));
    }

    @Operation(summary = "My attendance rows for a date range "
            + "(defaults to current month)")
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<EmployeeAttendance>>> myMonthly(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        String employeeId = attendanceService.resolveEmployeeIdForUser(userId);
        if (employeeId == null) {
            // Not linked to any employee — return an empty list
            // rather than a 404 so the "My Attendance" page can
            // render its "You're not linked to an employee record"
            // empty state instead of showing a broken screen.
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }
        List<EmployeeAttendance> rows = attendanceService.getMonthly(employeeId, from, to);
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    @Operation(summary = "Public attendance settings — the subset any "
            + "logged-in employee needs to render the Mark button")
    @GetMapping("/settings/public")
    public ResponseEntity<ApiResponse<PublicAttendanceSettingsDto>> publicSettings() {
        return ResponseEntity.ok(ApiResponse.success(
                PublicAttendanceSettingsDto.from(settingsService.getOrCreate())));
    }

    // ── HR-facing ────────────────────────────────────────────

    @Operation(summary = "Everyone's attendance for a given date (HR only)")
    @GetMapping("/daily")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<EmployeeAttendance>>> daily(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getDaily(date)));
    }

    @Operation(summary = "One employee's monthly rows (HR only — the "
            + "employee's own view uses /my instead)")
    @GetMapping("/monthly/{employeeId}")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<EmployeeAttendance>>> monthly(
            @PathVariable String employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.getMonthly(employeeId, from, to)));
    }

    @Operation(summary = "Manually stamp an attendance row (HR only)")
    @PostMapping("/mark-manual")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<EmployeeAttendance>> markManual(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody ManualMarkRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.markManual(req, userId), "Attendance saved"));
    }
}
