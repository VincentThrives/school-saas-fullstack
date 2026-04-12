package com.saas.school.modules.assignment.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.assignment.dto.CreateAssignmentRequest;
import com.saas.school.modules.assignment.dto.GradeSubmissionRequest;
import com.saas.school.modules.assignment.dto.SubmitAssignmentRequest;
import com.saas.school.modules.assignment.model.Assignment;
import com.saas.school.modules.assignment.model.AssignmentSubmission;
import com.saas.school.modules.assignment.service.AssignmentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Assignments")
@RestController
@RequestMapping("/api/v1/assignments")
public class AssignmentController {

    @Autowired
    private AssignmentService assignmentService;

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Assignment>> create(
            @RequestBody CreateAssignmentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.createAssignment(req, userId, null), "Assignment created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Assignment>>> list(
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String teacherId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (classId != null) {
            return ResponseEntity.ok(ApiResponse.success(
                    assignmentService.getAssignmentsByClass(classId, PageRequest.of(page, size))));
        }
        if (teacherId != null) {
            return ResponseEntity.ok(ApiResponse.success(
                    assignmentService.getAssignmentsByTeacher(teacherId, PageRequest.of(page, size))));
        }
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.getAssignmentsByClass("", PageRequest.of(page, size))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Assignment>> detail(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getAssignmentById(id)));
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<Assignment>> publish(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.publishAssignment(id), "Assignment published"));
    }

    @PatchMapping("/{id}/close")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<Assignment>> close(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.closeAssignment(id), "Assignment closed"));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AssignmentSubmission>> submit(
            @PathVariable String id,
            @RequestBody SubmitAssignmentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.submitAssignment(id, userId, null, req), "Assignment submitted"));
    }

    @GetMapping("/{id}/submissions")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Page<AssignmentSubmission>>> submissions(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.getSubmissions(id, PageRequest.of(page, size))));
    }

    @PatchMapping("/submissions/{submissionId}/grade")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<AssignmentSubmission>> grade(
            @PathVariable String submissionId,
            @RequestBody GradeSubmissionRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                assignmentService.gradeSubmission(submissionId, req, userId), "Submission graded"));
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getStats(id)));
    }
}
