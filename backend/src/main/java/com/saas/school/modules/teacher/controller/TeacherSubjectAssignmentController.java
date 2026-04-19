package com.saas.school.modules.teacher.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.teacher.dto.CarryForwardAssignmentsRequest;
import com.saas.school.modules.teacher.dto.CreateTeacherAssignmentRequest;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.service.TeacherSubjectAssignmentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Teacher Subject Assignments")
@RestController
@RequestMapping("/api/v1/teacher-assignments")
public class TeacherSubjectAssignmentController {

    private static final Logger logger = LoggerFactory.getLogger(TeacherSubjectAssignmentController.class);

    @Autowired private TeacherSubjectAssignmentService service;
    @Autowired private TeacherRepository teacherRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<TeacherSubjectAssignment>>> list(
            @RequestParam(required = false) String teacherId,
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String sectionId) {
        return ResponseEntity.ok(ApiResponse.success(service.list(teacherId, academicYearId, classId, sectionId)));
    }

    /** Teacher self-service — returns the caller's own assignments for the given year. */
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<TeacherSubjectAssignment>>> mine(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String academicYearId) {
        Teacher me = teacherRepository.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        if (me == null) return ResponseEntity.ok(ApiResponse.success(List.of()));
        return ResponseEntity.ok(ApiResponse.success(service.listForTeacher(me.getTeacherId(), academicYearId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<TeacherSubjectAssignment>> create(
            @RequestBody CreateTeacherAssignmentRequest req) {
        logger.info("Create assignment teacher={} year={} class={} section={} subject={}",
                req.getTeacherId(), req.getAcademicYearId(), req.getClassId(), req.getSectionId(), req.getSubjectId());
        return ResponseEntity.ok(ApiResponse.success(service.create(req), "Assignment created"));
    }

    @PutMapping("/{assignmentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<TeacherSubjectAssignment>> update(
            @PathVariable String assignmentId,
            @RequestBody CreateTeacherAssignmentRequest req) {
        return ResponseEntity.ok(ApiResponse.success(service.update(assignmentId, req), "Assignment updated"));
    }

    @DeleteMapping("/{assignmentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String assignmentId) {
        service.delete(assignmentId);
        return ResponseEntity.ok(ApiResponse.success(null, "Assignment deleted"));
    }

    @PostMapping("/carry-forward")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> carryForward(
            @RequestBody CarryForwardAssignmentsRequest req) {
        int n = service.carryForward(req);
        Map<String, Object> body = new HashMap<>();
        body.put("copied", n);
        body.put("fromAcademicYearId", req.getFromAcademicYearId());
        body.put("toAcademicYearId", req.getToAcademicYearId());
        return ResponseEntity.ok(ApiResponse.success(body, "Carried forward " + n + " assignments"));
    }
}
