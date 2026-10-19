package com.saas.school.modules.examscheme.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.examscheme.model.Scheme;
import com.saas.school.modules.examscheme.service.SchemeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Exam Schemes")
@RestController
@RequestMapping("/api/v1/exam-schemes")
public class SchemeController {

    @Autowired private SchemeService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Scheme>>> list(
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived,
            @RequestParam(required = false) String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(service.list(includeArchived, academicYearId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Scheme>> create(@RequestBody Scheme req) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Scheme created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Scheme>> update(@PathVariable String id, @RequestBody Scheme req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, req), "Scheme updated"));
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Scheme>> archive(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.archive(id), "Archived"));
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Scheme>> restore(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.restore(id), "Restored"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Scheme deleted"));
    }

    @GetMapping("/{id}/rollout/status")
    public ResponseEntity<ApiResponse<List<SchemeService.RolloutStatusRow>>> rolloutStatus(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.rolloutStatus(id)));
    }

    @GetMapping("/{id}/subjects")
    public ResponseEntity<ApiResponse<List<SchemeService.SubjectSeedRow>>> subjectsForScheme(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.subjectsForScheme(id)));
    }

    @PostMapping("/{id}/slots/{slotKey}/rollout")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<SchemeService.RolloutResult>> rollout(
            @PathVariable String id,
            @PathVariable String slotKey,
            @RequestParam(required = false) String examName) {
        return ResponseEntity.ok(ApiResponse.success(service.rolloutSlot(id, slotKey, examName), "Slot rolled out"));
    }
}
