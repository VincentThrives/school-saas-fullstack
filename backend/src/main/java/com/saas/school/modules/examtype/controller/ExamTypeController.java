package com.saas.school.modules.examtype.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.examtype.model.ExamType;
import com.saas.school.modules.examtype.service.ExamTypeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Exam Types")
@RestController
@RequestMapping("/api/v1/exam-types")
public class ExamTypeController {

    @Autowired private ExamTypeService service;

    /** Any authenticated tenant user may read — dropdowns need this on teacher/student pages. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamType>>> list(
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        return ResponseEntity.ok(ApiResponse.success(service.list(includeArchived)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<ExamType>> create(@RequestBody ExamType req) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Exam type created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<ExamType>> update(@PathVariable String id, @RequestBody ExamType req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, req), "Exam type updated"));
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<ExamType>> archive(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.archive(id), "Archived"));
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<ExamType>> restore(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.restore(id), "Restored"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Exam type deleted"));
    }
}
