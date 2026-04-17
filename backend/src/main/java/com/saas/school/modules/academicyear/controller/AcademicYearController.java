package com.saas.school.modules.academicyear.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.service.AcademicYearService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@Tag(name="Academic Years")
@RestController
@RequestMapping("/api/v1/academic-years")
public class AcademicYearController {
    @Autowired private AcademicYearService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AcademicYear>>> list() {
        return ResponseEntity.ok(ApiResponse.success(service.listAll()));
    }
    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> create(@RequestBody AcademicYear req) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Created"));
    }
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> update(@PathVariable String id, @RequestBody AcademicYear req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, req), "Updated"));
    }

    @PatchMapping("/{id}/set-current")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> setCurrent(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.setCurrent(id)));
    }
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> archive(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.archive(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Academic year deleted"));
    }
}