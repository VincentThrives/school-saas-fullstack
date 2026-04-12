package com.saas.school.modules.attendance.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.service.AttendanceService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate; import java.util.List;
@Tag(name="Attendance")
@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
public class AttendanceController {
    private final AttendanceService attendanceService;

    @PostMapping("/mark")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<List<Attendance>>> mark(
            @Valid @RequestBody MarkAttendanceRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
            attendanceService.markAttendance(req, userId), "Attendance marked"));
    }

    @GetMapping("/summary/student/{studentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<AttendanceSummaryDto>> studentSummary(
            @PathVariable String studentId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(
            attendanceService.getStudentSummary(studentId, from, to)));
    }

    @GetMapping("/class/{classId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<Attendance>>> classAttendance(
            @PathVariable String classId,
            @RequestParam String sectionId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(
            attendanceService.getClassAttendance(classId, sectionId, date)));
    }
}