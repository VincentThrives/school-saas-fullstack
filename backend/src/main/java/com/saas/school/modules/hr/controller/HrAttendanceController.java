package com.saas.school.modules.hr.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.hr.dto.HrEmployeeOptionDto;
import com.saas.school.modules.hr.dto.ManualMarkRequest;
import com.saas.school.modules.hr.dto.MarkSelfAttendanceRequest;
import com.saas.school.modules.hr.dto.MarkSelfResponse;
import com.saas.school.modules.hr.dto.PublicAttendanceSettingsDto;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.service.EmployeeAttendanceService;
import com.saas.school.modules.hr.service.EmployeeAttendanceSettingsService;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import org.springframework.data.domain.Pageable;
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
    /** Used only by the HR employees dropdown that drives the
     *  manual-mark dialog's "Add missing employee" picker. */
    @Autowired private TeacherRepository teacherRepo;

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

    @Operation(summary = "Declared holidays overlapping a date range. "
            + "Employee-facing so the /hr/attendance/my calendar can tint "
            + "holiday days without hitting the admin-gated events endpoint.")
    @GetMapping("/holidays")
    public ResponseEntity<ApiResponse<com.saas.school.modules.hr.dto.HrAttendanceReportResponse>> holidays(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.getHolidaysInRange(from, to)));
    }

    // ── HR-facing ────────────────────────────────────────────

    @Operation(summary = "Everyone's attendance for a given date (HR only) — "
            + "each row includes the employee's display name + designation so the "
            + "frontend doesn't need to hit the admin-gated /employees endpoint.")
    @GetMapping("/daily")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<com.saas.school.modules.hr.dto.HrDailyAttendanceDto>>> daily(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(attendanceService.getDailyEnriched(date)));
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

    @Operation(summary = "Attendance report — everyone's rows across a date range (HR only). "
            + "Each row carries the employee name + designation, so the frontend can group / "
            + "aggregate on the client without a second lookup call.")
    @GetMapping("/report")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<com.saas.school.modules.hr.dto.HrAttendanceReportResponse>> report(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
                attendanceService.getReportEnriched(from, to)));
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

    @Operation(summary = "All employees available for HR to manually mark "
            + "attendance for — drives the picker on the manual-mark dialog. "
            + "HR-only because the admin GET /employees endpoint isn't accessible to HR.")
    @GetMapping("/employees")
    @PreAuthorize("hasRole('HR')")
    public ResponseEntity<ApiResponse<List<HrEmployeeOptionDto>>> employees() {
        // Cap at 500 — enough for any real school; unpaged so we
        // don't lose staff on a large tenant.
        List<Teacher> all = teacherRepo.findByDeletedAtIsNull(Pageable.unpaged()).getContent();
        List<HrEmployeeOptionDto> out = all.stream()
            .map(t -> new HrEmployeeOptionDto(
                t.getTeacherId(),
                displayName(t),
                t.getEmployeeRole()))
            .sorted((a, b) -> {
                String an = a.getName() == null ? "" : a.getName();
                String bn = b.getName() == null ? "" : b.getName();
                return an.compareToIgnoreCase(bn);
            })
            .toList();
        return ResponseEntity.ok(ApiResponse.success(out));
    }

    private static String displayName(Teacher t) {
        String first = t.getFirstName() == null ? "" : t.getFirstName().trim();
        String last  = t.getLastName() == null ? "" : t.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (t.getEmployeeId() != null) return "Emp " + t.getEmployeeId();
        return t.getTeacherId();
    }
}
