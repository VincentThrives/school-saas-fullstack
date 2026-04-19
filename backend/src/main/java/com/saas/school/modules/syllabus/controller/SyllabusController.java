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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Syllabus")
@RestController
@RequestMapping("/api/v1/syllabus")
public class SyllabusController {

    private static final Logger logger = LoggerFactory.getLogger(SyllabusController.class);

    @Autowired
    private SyllabusService syllabusService;

    /** Extract current role string from the security context. */
    private String currentRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) return null;
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .filter(a -> a != null && a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .findFirst()
                .orElse(null);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<List<Syllabus>>> getSyllabi(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String sectionId,
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) String teacherId,
            @RequestParam(required = false, defaultValue = "false") boolean mine) {
        logger.info("List syllabi ay={} cls={} sec={} subj={} teacher={} mine={}",
                academicYearId, classId, sectionId, subjectId, teacherId, mine);
        List<Syllabus> syllabi = syllabusService.list(
                academicYearId, classId, sectionId, subjectId, teacherId, mine, userId, currentRole());
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
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> createSyllabus(
            @Valid @RequestBody CreateSyllabusRequest request,
            @AuthenticationPrincipal String userId) {
        logger.info("Create syllabus: classId={}, sectionId={}, subjectId={}",
                request.getClassId(), request.getSectionId(), request.getSubjectId());
        Syllabus syllabus = syllabusService.createSyllabus(request, userId, currentRole());
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Syllabus created successfully"));
    }

    @PutMapping("/{syllabusId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> updateSyllabus(
            @PathVariable String syllabusId,
            @Valid @RequestBody CreateSyllabusRequest request,
            @AuthenticationPrincipal String userId) {
        logger.info("Request to update syllabus: syllabusId={}", syllabusId);
        Syllabus syllabus = syllabusService.updateSyllabus(syllabusId, request, userId, currentRole());
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Syllabus updated successfully"));
    }

    @PatchMapping("/{syllabusId}/topics")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Syllabus>> updateTopicStatus(
            @PathVariable String syllabusId,
            @Valid @RequestBody UpdateTopicRequest request,
            @AuthenticationPrincipal String userId) {
        logger.info("Request to update topic status: syllabusId={}, topicId={}", syllabusId, request.getTopicId());
        Syllabus syllabus = syllabusService.updateTopicStatus(syllabusId, request, userId, currentRole());
        return ResponseEntity.ok(ApiResponse.success(syllabus, "Topic status updated successfully"));
    }

    @DeleteMapping("/{syllabusId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Void>> deleteSyllabus(
            @PathVariable String syllabusId,
            @AuthenticationPrincipal String userId) {
        logger.info("Request to delete syllabus: syllabusId={}", syllabusId);
        syllabusService.deleteSyllabus(syllabusId, userId, currentRole());
        return ResponseEntity.ok(ApiResponse.success(null, "Syllabus deleted successfully"));
    }
}
