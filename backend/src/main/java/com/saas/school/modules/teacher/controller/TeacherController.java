package com.saas.school.modules.teacher.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@Tag(name="Teachers")
@RestController
@RequestMapping("/api/v1/teachers")
public class TeacherController {
    @Autowired private TeacherRepository teacherRepo;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<Teacher>>> list(
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        Page<Teacher> result = teacherRepo.findByDeletedAtIsNull(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(
            PageResponse.of(result.getContent(), result.getTotalElements(), page, size)));
    }
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Teacher>> get(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
            teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new com.saas.school.common.exception.ResourceNotFoundException("Teacher", id))));
    }
    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> create(@RequestBody Teacher req) {
        req.setTeacherId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(teacherRepo.save(req), "Created"));
    }
}