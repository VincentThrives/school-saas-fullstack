package com.saas.school.modules.attendance.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.service.AttendanceService;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate; import java.util.*; import java.util.stream.Collectors;
@Tag(name="Attendance")
@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {
    @Autowired private AttendanceService attendanceService;
    @Autowired private TenantRepository tenantRepository;

    @GetMapping("/mode")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> getAttendanceMode() {
        String tenantId = TenantContext.getTenantId();
        TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenantId != null) TenantContext.setTenantId(tenantId);
        String mode = tenant != null && tenant.getAttendanceMode() != null ? tenant.getAttendanceMode() : "DAY_WISE";
        return ResponseEntity.ok(ApiResponse.success(Map.of("mode", mode)));
    }

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

    @GetMapping("/report/class/{classId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classReport(
            @PathVariable String classId,
            @RequestParam String sectionId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {

        // Get all attendance records for this class/section in date range
        List<Attendance> allRecords = attendanceService.getClassAttendanceRange(classId, sectionId, from, to);

        // Group by studentId
        Map<String, List<Attendance>> byStudent = allRecords.stream()
                .collect(Collectors.groupingBy(Attendance::getStudentId));

        List<Map<String, Object>> studentReports = new ArrayList<>();
        long totalPresent = 0, totalAbsent = 0, totalLate = 0, totalHalfDay = 0, totalDays = 0;

        for (var entry : byStudent.entrySet()) {
            List<Attendance> records = entry.getValue();
            long present = records.stream().filter(a -> a.getStatus() == Attendance.Status.PRESENT).count();
            long absent = records.stream().filter(a -> a.getStatus() == Attendance.Status.ABSENT).count();
            long late = records.stream().filter(a -> a.getStatus() == Attendance.Status.LATE).count();
            long halfDay = records.stream().filter(a -> a.getStatus() == Attendance.Status.HALF_DAY).count();
            long total = records.size();
            double pct = total > 0 ? Math.round(present * 1000.0 / total) / 10.0 : 0;

            Map<String, Object> report = new HashMap<>();
            report.put("studentId", entry.getKey());
            report.put("present", present);
            report.put("absent", absent);
            report.put("late", late);
            report.put("halfDay", halfDay);
            report.put("totalDays", total);
            report.put("percentage", pct);
            studentReports.add(report);

            totalPresent += present; totalAbsent += absent; totalLate += late;
            totalHalfDay += halfDay; totalDays += total;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("students", studentReports);
        result.put("totalStudents", byStudent.size());
        result.put("presentPercent", totalDays > 0 ? Math.round(totalPresent * 1000.0 / totalDays) / 10.0 : 0);
        result.put("absentPercent", totalDays > 0 ? Math.round(totalAbsent * 1000.0 / totalDays) / 10.0 : 0);
        result.put("latePercent", totalDays > 0 ? Math.round(totalLate * 1000.0 / totalDays) / 10.0 : 0);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}