package com.saas.school.modules.dashboard.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.dashboard.dto.DashboardDto;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    @Autowired private StudentRepository studentRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserRepository userRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard() {
        DashboardDto dto = new DashboardDto();
        dto.setTotalStudents(studentRepo.countByDeletedAtIsNull());
        dto.setTotalTeachers(teacherRepo.count());
        dto.setTotalUsers(userRepo.count());
        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}