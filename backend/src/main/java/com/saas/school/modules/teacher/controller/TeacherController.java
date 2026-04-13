package com.saas.school.modules.teacher.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "Teachers")
@RestController
@RequestMapping("/api/v1/teachers")
public class TeacherController {

    @Autowired private TeacherRepository teacherRepo;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<Teacher>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Teacher> result = teacherRepo.findByDeletedAtIsNull(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(
                PageResponse.of(result.getContent(), result.getTotalElements(), page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Teacher>> get(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"))));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> create(@RequestBody Teacher req) {
        req.setTeacherId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(teacherRepo.save(req), "Teacher created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> update(
            @PathVariable String id, @RequestBody Teacher req) {
        Teacher existing = teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));

        if (req.getFirstName() != null) existing.setFirstName(req.getFirstName());
        if (req.getLastName() != null) existing.setLastName(req.getLastName());
        if (req.getPhone() != null) existing.setPhone(req.getPhone());
        if (req.getEmail() != null) existing.setEmail(req.getEmail());
        if (req.getQualification() != null) existing.setQualification(req.getQualification());
        if (req.getSpecialization() != null) existing.setSpecialization(req.getSpecialization());
        if (req.getClassIds() != null) existing.setClassIds(req.getClassIds());
        if (req.getSubjectIds() != null) existing.setSubjectIds(req.getSubjectIds());

        return ResponseEntity.ok(ApiResponse.success(teacherRepo.save(existing), "Teacher updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        Teacher teacher = teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));
        teacher.setDeletedAt(Instant.now());
        teacherRepo.save(teacher);
        return ResponseEntity.ok(ApiResponse.success(null, "Teacher deleted"));
    }
}
