package com.saas.school.modules.exam.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.exam.dto.EnterInternalMarksRequest;
import com.saas.school.modules.exam.model.ComponentInternalMark;
import com.saas.school.modules.exam.service.ComponentInternalMarkService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoints for INTERNAL component marks (assignments, project
 * work, classroom observation — anything that doesn't go through an
 * Exam record).
 */
@Tag(name = "Exams")
@RestController
@RequestMapping("/api/v1/internal-marks")
public class ComponentInternalMarkController {

    @Autowired private ComponentInternalMarkService service;

    /**
     * Bulk upsert internal marks for a class on a single
     * (subject, component, year, term) tuple.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<List<ComponentInternalMark>>> saveBulk(
            @RequestBody EnterInternalMarksRequest req,
            @AuthenticationPrincipal Object principal) {
        // The auth filter sets the userId as the principal "name"; falling back to
        // toString keeps the audit log populated even if the principal shape changes.
        String enteredBy = principal == null ? null : principal.toString();
        List<ComponentInternalMark> saved = service.saveBulk(req, enteredBy);
        return ResponseEntity.ok(ApiResponse.success(saved, "Internal marks saved"));
    }

    /**
     * Read existing marks for a (subject, component, year, term) so
     * the marks-entry UI can pre-fill the grid.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<List<ComponentInternalMark>>> list(
            @RequestParam String subjectId,
            @RequestParam String componentKey,
            @RequestParam String academicYearId,
            @RequestParam(required = false) String termId) {
        List<ComponentInternalMark> rows = service.findForComponent(
                subjectId, componentKey, academicYearId, termId);
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    /**
     * Convenience: every internal mark for a single student in an
     * academic year. Used by parent / student dashboards and by the
     * report card aggregator.
     */
    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER','PARENT','STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listForStudent(
            @PathVariable String studentId,
            @RequestParam String academicYearId) {
        List<ComponentInternalMark> rows = service.findForStudent(studentId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("marks", rows)));
    }
}
