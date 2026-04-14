package com.saas.school.modules.attendance.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.service.AttendanceService;
import com.saas.school.modules.classes.repository.SubjectRepository;
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
import java.time.LocalDate; import java.util.*;

@Tag(name="Attendance")
@RestController
@RequestMapping("/api/v1/attendance")
public class AttendanceController {
    @Autowired private AttendanceService attendanceService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private SubjectRepository subjectRepository;

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
    public ResponseEntity<ApiResponse<StudentsAttendance>> mark(
            @Valid @RequestBody MarkAttendanceRequest req,
            @AuthenticationPrincipal String userId) {
        try {
            return ResponseEntity.ok(ApiResponse.success(
                attendanceService.markBatchAttendance(req, userId), "Attendance marked"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/timetable-periods")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getTimetablePeriods(
            @RequestParam String classId,
            @RequestParam String sectionId,
            @RequestParam(required = false) String academicYearId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date) {
        String ayId = academicYearId != null ? academicYearId : "";
        return ResponseEntity.ok(ApiResponse.success(
            attendanceService.getTimetablePeriodsForDate(classId, sectionId, ayId, date)));
    }

    @GetMapping("/batch/class/{classId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<StudentsAttendance>>> batchClassAttendance(
            @PathVariable String classId,
            @RequestParam String sectionId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.success(
            attendanceService.getBatchAttendance(classId, sectionId, date)));
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

    @GetMapping("/report/batch/class/{classId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchReport(
            @PathVariable String classId,
            @RequestParam String sectionId,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {

        List<StudentsAttendance> records =
                attendanceService.getBatchAttendanceRange(classId, sectionId, from, to);

        // Separate day-wise (periodNumber=0) and period-wise (periodNumber>0)
        List<StudentsAttendance> dayWise = new ArrayList<>();
        List<StudentsAttendance> periodWise = new ArrayList<>();
        for (var r : records) {
            if (r.getPeriodNumber() == 0) dayWise.add(r);
            else periodWise.add(r);
        }

        // Day-wise report: aggregate per student
        Map<String, long[]> dayStudentStats = new LinkedHashMap<>();
        for (var rec : dayWise) {
            if (rec.getEntries() == null) continue;
            for (var e : rec.getEntries()) {
                long[] s = dayStudentStats.computeIfAbsent(e.getStudentId(), k -> new long[4]);
                s[3]++;
                if ("PRESENT".equals(e.getStatus())) s[0]++;
                else if ("ABSENT".equals(e.getStatus())) s[1]++;
                else if ("LATE".equals(e.getStatus())) s[2]++;
            }
        }
        List<Map<String, Object>> dayStudents = new ArrayList<>();
        for (var entry : dayStudentStats.entrySet()) {
            long[] s = entry.getValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", entry.getKey());
            m.put("present", s[0]); m.put("absent", s[1]); m.put("late", s[2]); m.put("totalDays", s[3]);
            m.put("percentage", s[3] > 0 ? Math.round(s[0] * 1000.0 / s[3]) / 10.0 : 0);
            dayStudents.add(m);
        }

        // Period-wise: per student per subject
        Map<String, Map<String, long[]>> periodStudentSubject = new LinkedHashMap<>();

        // Resolve subject names from DB
        Set<String> allSubjectIds = new HashSet<>();
        for (var rec : periodWise) {
            if (rec.getSubjectId() != null) allSubjectIds.add(rec.getSubjectId());
        }
        Map<String, String> subjectNames = new LinkedHashMap<>();
        if (!allSubjectIds.isEmpty()) {
            subjectRepository.findBySubjectIdIn(new ArrayList<>(allSubjectIds))
                    .forEach(s -> subjectNames.put(s.getSubjectId(), s.getName()));
        }
        // Fallback: if not found in DB, use the ID
        for (String id : allSubjectIds) {
            subjectNames.putIfAbsent(id, id);
        }

        for (var rec : periodWise) {
            if (rec.getEntries() == null) continue;
            for (var e : rec.getEntries()) {
                String subId = rec.getSubjectId() != null ? rec.getSubjectId() : "unknown";
                long[] s = periodStudentSubject
                        .computeIfAbsent(e.getStudentId(), k -> new LinkedHashMap<>())
                        .computeIfAbsent(subId, k -> new long[4]);
                s[3]++;
                if ("PRESENT".equals(e.getStatus())) s[0]++;
                else if ("ABSENT".equals(e.getStatus())) s[1]++;
                else if ("LATE".equals(e.getStatus())) s[2]++;
            }
        }
        List<Map<String, Object>> periodDetails = new ArrayList<>();
        for (var studentEntry : periodStudentSubject.entrySet()) {
            for (var subEntry : studentEntry.getValue().entrySet()) {
                long[] s = subEntry.getValue();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("studentId", studentEntry.getKey());
                m.put("subjectId", subEntry.getKey());
                m.put("subjectName", subjectNames.getOrDefault(subEntry.getKey(), subEntry.getKey()));
                m.put("present", s[0]); m.put("absent", s[1]); m.put("late", s[2]); m.put("totalDays", s[3]);
                m.put("percentage", s[3] > 0 ? Math.round(s[0] * 1000.0 / s[3]) / 10.0 : 0);
                periodDetails.add(m);
            }
        }

        // Subject summaries
        Map<String, long[]> subjectTotals = new LinkedHashMap<>();
        for (var rec : periodWise) {
            if (rec.getEntries() == null || rec.getSubjectId() == null) continue;
            long[] s = subjectTotals.computeIfAbsent(rec.getSubjectId(), k -> new long[4]);
            for (var e : rec.getEntries()) {
                s[3]++;
                if ("PRESENT".equals(e.getStatus())) s[0]++;
                else if ("ABSENT".equals(e.getStatus())) s[1]++;
                else if ("LATE".equals(e.getStatus())) s[2]++;
            }
        }
        List<Map<String, Object>> subjectSummaries = new ArrayList<>();
        for (var entry : subjectTotals.entrySet()) {
            long[] s = entry.getValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("subjectId", entry.getKey());
            m.put("subjectName", subjectNames.getOrDefault(entry.getKey(), entry.getKey()));
            m.put("present", s[0]); m.put("absent", s[1]); m.put("late", s[2]); m.put("totalDays", s[3]);
            m.put("presentPercent", s[3] > 0 ? Math.round(s[0] * 1000.0 / s[3]) / 10.0 : 0);
            subjectSummaries.add(m);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dayWiseStudents", dayStudents);
        result.put("periodWiseDetails", periodDetails);
        result.put("subjectSummaries", subjectSummaries);
        result.put("totalDayRecords", dayWise.size());
        result.put("totalPeriodRecords", periodWise.size());
        result.put("totalStudents", Math.max(dayStudentStats.size(), periodStudentSubject.size()));

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
