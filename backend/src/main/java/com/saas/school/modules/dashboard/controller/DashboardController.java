package com.saas.school.modules.dashboard.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.dashboard.dto.DashboardDto;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    @Autowired private StudentRepository studentRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SchoolClassRepository classRepo;
    @Autowired private AttendanceRepository attendanceRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard() {
        DashboardDto dto = new DashboardDto();
        dto.setTotalStudents(studentRepo.countByDeletedAtIsNull());
        // Respect soft-delete on both teachers and users so the dashboard matches the list pages
        dto.setTotalTeachers(teacherRepo.countByDeletedAtIsNull());
        dto.setTotalUsers(userRepo.count());
        dto.setTotalClasses(classRepo.count());
        dto.setAttendanceTodayPercent(computeTodaysAttendancePercent());
        return ResponseEntity.ok(ApiResponse.success(dto));
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
