package com.saas.school.modules.student.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.service.StudentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Students")
@RestController
@RequestMapping("/api/v1/students")
@RequiredArgsConstructor
public class StudentController {
    private final StudentService studentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<PageResponse<StudentDto>>> list(
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,
            @RequestParam(required=false) String classId,
            @RequestParam(required=false) String sectionId,
            @RequestParam(required=false) String search) {
        return ResponseEntity.ok(ApiResponse.success(
            studentService.listStudents(page, size, classId, sectionId, search)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<StudentDto>> get(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(studentService.getStudent(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentDto>> create(@Valid @RequestBody CreateStudentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(studentService.createStudent(req), "Student created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentDto>> update(
            @PathVariable String id, @Valid @RequestBody UpdateStudentRequest req) {
        return ResponseEntity.ok(ApiResponse.success(studentService.updateStudent(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        studentService.deleteStudent(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Student deleted"));
    }

    @PostMapping("/bulk-promote")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<BulkPromoteResult>> bulkPromote(
            @Valid @RequestBody BulkPromoteRequest req) {
        return ResponseEntity.ok(ApiResponse.success(studentService.bulkPromote(req)));
    }
}