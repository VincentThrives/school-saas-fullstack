package com.saas.school.modules.dashboard.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.dashboard.dto.DashboardDto;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final StudentRepository studentRepo;
    private final TeacherRepository teacherRepo;
    private final UserRepository userRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard() {
        DashboardDto dto = DashboardDto.builder()
            .totalStudents(studentRepo.countByDeletedAtIsNull())
            .totalTeachers(teacherRepo.count())
            .totalUsers(userRepo.count())
            .build();
        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}