package com.saas.school.modules.dashboard.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.dashboard.dto.DashboardDto;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    @Autowired private StudentRepository studentRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SchoolClassRepository classRepo;
    @Autowired private AttendanceRepository attendanceRepo;
    @Autowired private AcademicYearRepository academicYearRepo;

    /**
     * Dashboard stats. If {@code academicYearId} is passed, counts are scoped
     * to that year. When omitted, the backend defaults to the current year
     * so the admin dashboard always reflects the active session.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard(
            @RequestParam(required = false) String academicYearId) {
        // Resolve effective academic year: request > current > none
        String effectiveYearId = academicYearId;
        if (effectiveYearId == null || effectiveYearId.isBlank()) {
            effectiveYearId = academicYearRepo.findByIsCurrent(true)
                    .map(AcademicYear::getAcademicYearId)
                    .orElse(null);
        }

        DashboardDto dto = new DashboardDto();

        if (effectiveYearId == null) {
            // No academic year configured yet — fall back to global counts.
            dto.setTotalStudents(studentRepo.countByDeletedAtIsNull());
            dto.setTotalTeachers(teacherRepo.countByDeletedAtIsNull());
            dto.setTotalUsers(userRepo.count());
            dto.setTotalClasses(classRepo.count());
            dto.setAttendanceTodayPercent(computeTodaysAttendancePercent());
            return ResponseEntity.ok(ApiResponse.success(dto));
        }

        // ── Year-scoped counts ──────────────────────────────────────────
        dto.setTotalStudents(countStudentsForYear(effectiveYearId));
        dto.setTotalClasses(countClassesForYear(effectiveYearId));
        // Teachers and users are not year-scoped in the data model; keep global soft-delete-respecting counts.
        dto.setTotalTeachers(teacherRepo.countByDeletedAtIsNull());
        dto.setTotalUsers(userRepo.count());
        dto.setAttendanceTodayPercent(computeTodaysAttendancePercent());
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    private long countStudentsForYear(String academicYearId) {
        // StudentRepository exposes a Page finder by academicYearId + soft-delete
        // filter. We use findByDeletedAtIsNull + in-memory filter here because
        // there's no direct count() variant. Volumes are small (hundreds per tenant).
        List<Student> all = studentRepo.findByDeletedAtIsNull();
        long n = 0;
        for (Student s : all) {
            if (academicYearId.equals(s.getAcademicYearId())) n++;
        }
        return n;
    }

    private long countClassesForYear(String academicYearId) {
        List<SchoolClass> rows = classRepo.findByAcademicYearId(academicYearId);
        return rows == null ? 0 : rows.size();
    }

    /**
     * Today's attendance rate across the whole tenant.
     * Denominator = total attendance records entered for today.
     * Numerator   = records with status PRESENT or LATE (late still counts as present).
     * Returns 0.0 when no attendance has been marked yet today.
     */
    private Double computeTodaysAttendancePercent() {
        LocalDate today = LocalDate.now();
        long total = attendanceRepo.countByDate(today);
        if (total == 0) return 0.0;
        long present = attendanceRepo.countByDateAndStatus(today, Attendance.Status.PRESENT)
                     + attendanceRepo.countByDateAndStatus(today, Attendance.Status.LATE);
        double pct = (present * 100.0) / total;
        return Math.round(pct * 10.0) / 10.0; // one decimal place
    }
}
