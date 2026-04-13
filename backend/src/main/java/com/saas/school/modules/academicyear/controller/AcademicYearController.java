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
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> create(@RequestBody AcademicYear req) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Created"));
    }
    @PatchMapping("/{id}/set-current")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> setCurrent(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.setCurrent(id)));
    }
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<AcademicYear>> archive(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(service.archive(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Academic year deleted"));
    }
}