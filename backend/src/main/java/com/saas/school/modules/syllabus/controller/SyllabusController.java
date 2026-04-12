package com.saas.school.modules.syllabus.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.syllabus.dto.CreateSyllabusRequest;
import com.saas.school.modules.syllabus.dto.UpdateTopicRequest;
import com.saas.school.modules.syllabus.model.Syllabus;
import com.saas.school.modules.syllabus.service.SyllabusService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Syllabus")
@RestController
@RequestMapping("/api/v1/syllabus")
public class SyllabusController {

    private static final Logger logger = LoggerFactory.getLogger(SyllabusController.class);

    @Autowired
    private SyllabusService syllabusService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<List<Syllabus>>> getSyllabi(
            @RequestParam String classId,
            @RequestParam String academicYearId) {
        logger.info("Request to list syllabi: classId={}, academicYearId={}", classId, academicYearId);
        List<Syllabus> syllabi = syllabusService.getSyllabiByClassAndYear(classId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(syllabi));
    }

    @GetMapping("/{syllabusId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<Syllabus>> getSyllabusById(@PathVariable String syllabusId) {
        logger.info("Request to get syllabus: syllabusId={}", syllabusId);
        Syllabus syllabus = syllabusService.getSyllabusById(syllabusId);
        return ResponseEntity.ok(ApiResponse.success(syllabus));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> createSyllabus(
            @Valid @RequestBody CreateSyllabusRequest request,
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String teacherId,
            @RequestParam(required = false) String tenantId) {
        logger.info("Request to create syllabus: classId={}, subjectId={}", request.getClassId(), request.getSubjectId());
        Syllabus syllabus = syllabusService.createSyllabus(request, teacherId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Syllabus created successfully"));
    }

    @PutMapping("/{syllabusId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> updateSyllabus(
            @PathVariable String syllabusId,
            @Valid @RequestBody CreateSyllabusRequest request) {
        logger.info("Request to update syllabus: syllabusId={}", syllabusId);
        Syllabus syllabus = syllabusService.updateSyllabus(syllabusId, request);
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Syllabus updated successfully"));
    }

    @PatchMapping("/{syllabusId}/topics")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> updateTopicStatus(
            @PathVariable String syllabusId,
            @Valid @RequestBody UpdateTopicRequest request) {
        logger.info("Request to update topic status: syllabusId={}, topicIndex={}", syllabusId, request.getTopicIndex());
        Syllabus syllabus = syllabusService.updateTopicStatus(syllabusId, request);
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Topic status updated successfully"));
    }

    @DeleteMapping("/{syllabusId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteSyllabus(@PathVariable String syllabusId) {
        logger.info("Request to delete syllabus: syllabusId={}", syllabusId);
        syllabusService.deleteSyllabus(syllabusId);
        return ResponseEntity.ok(ApiResponse.success(null, "Syllabus deleted successfully"));
    }
}
