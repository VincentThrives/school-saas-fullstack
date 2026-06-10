package com.saas.school.modules.exam.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.exam.dto.BulkCreateExamRequest;
import com.saas.school.modules.exam.dto.BulkCreateExamResponse;
import com.saas.school.modules.exam.dto.EnterMarksRequest;
import com.saas.school.modules.exam.dto.ExamConfigDetail;
import com.saas.school.modules.exam.dto.ExamConfigSummary;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.service.ExamService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Exams")
@RestController
@RequestMapping("/api/v1/exams")
public class ExamController {

    @Autowired private ExamService examService;
    @Autowired private ExamMarkRepository markRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Exam>>> list(
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(examService.listExams(classId, academicYearId)));
    }

    @GetMapping("/{examId}")
    public ResponseEntity<ApiResponse<Exam>> getById(@PathVariable String examId) {
        return ResponseEntity.ok(ApiResponse.success(examService.getExamById(examId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Exam>> create(@RequestBody Exam req) {
        return ResponseEntity.ok(ApiResponse.success(examService.createExam(req), "Exam created"));
    }

    /**
     * Bulk-create exams from a single Exam Config submission — admin picks
     * an exam type, multi-selects class+section pairs and subjects, and the
     * server fans out into individual Exam docs. Skips duplicates and
     * un-configured combinations silently; the response reports the counts.
     */
    @PostMapping("/bulk")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<BulkCreateExamResponse>> bulkCreate(@RequestBody BulkCreateExamRequest req) {
        BulkCreateExamResponse out = examService.bulkCreate(req);
        String msg = "Created " + out.getCreated() + " exam(s)"
                + (out.getSkippedDuplicate() > 0 ? " · " + out.getSkippedDuplicate() + " duplicate(s) skipped" : "")
                + (out.getSkippedNotConfigured() > 0 ? " · " + out.getSkippedNotConfigured() + " combination(s) not configured" : "");
        return ResponseEntity.ok(ApiResponse.success(out, msg));
    }

    // ── Exam Config list / detail / delete (the View page) ───────────

    /** List existing Exam Configs (one row per [year, examType] tuple). */
    @GetMapping("/configs")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<List<ExamConfigSummary>>> listConfigs() {
        return ResponseEntity.ok(ApiResponse.success(examService.listConfigs()));
    }

    /** Pre-fill payload for the edit form. */
    @GetMapping("/configs/detail")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<ExamConfigDetail>> getConfigDetail(
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        return ResponseEntity.ok(ApiResponse.success(
                examService.getConfigDetail(academicYearId, examType)));
    }

    /** Light marks-status probe — drives the warning popup before edit/delete. */
    @GetMapping("/configs/marks-status")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getConfigMarksStatus(
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        boolean has = examService.hasMarksForConfig(academicYearId, examType);
        return ResponseEntity.ok(ApiResponse.success(Map.of("anyMarksEntered", has)));
    }

    /** Delete every exam + marks doc tied to this config. Cascades. */
    @DeleteMapping("/configs")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteConfig(
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        Map<String, Object> out = examService.deleteConfig(academicYearId, examType);
        return ResponseEntity.ok(ApiResponse.success(out, "Config deleted"));
    }

    @PutMapping("/{examId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Exam>> update(
            @PathVariable String examId, @RequestBody Exam req) {
        return ResponseEntity.ok(ApiResponse.success(examService.updateExam(examId, req), "Exam updated"));
    }

    @DeleteMapping("/{examId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String examId) {
        examService.deleteExam(examId);
        return ResponseEntity.ok(ApiResponse.success(null, "Exam deleted"));
    }

    @PostMapping("/marks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<com.saas.school.modules.exam.model.StudentAssessments>> enterMarks(
            @Valid @RequestBody EnterMarksRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(examService.enterBatchMarks(req, userId), "Marks saved"));
    }

    @GetMapping("/{examId}/marks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<com.saas.school.modules.exam.model.StudentAssessments.MarkEntry>>> getMarks(
            @PathVariable String examId) {
        return ResponseEntity.ok(ApiResponse.success(examService.getBatchMarks(examId)));
    }

    // Student views own marks (optionally narrowed to a single academic year).
    @GetMapping("/my-marks")
    public ResponseEntity<ApiResponse<List<ExamMark>>> getMyMarks(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(
                examService.getStudentMarks(userId, academicYearId)));
    }

    // Get marks for a specific student (for parents/admin)
    @GetMapping("/student/{studentId}/marks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','PARENT')")
    public ResponseEntity<ApiResponse<List<ExamMark>>> getStudentMarks(
            @PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(examService.getStudentMarks(studentId)));
    }

    // Get upcoming/all exams for calendar
    @GetMapping("/calendar")
    public ResponseEntity<ApiResponse<List<Exam>>> getExamCalendar() {
        return ResponseEntity.ok(ApiResponse.success(examService.getUpcomingExams()));
    }

    @GetMapping("/{examId}/results")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getExamResults(@PathVariable String examId) {
        return ResponseEntity.ok(ApiResponse.success(examService.getExamResults(examId)));
    }

    @PatchMapping("/{examId}/lock-marks")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> lockMarks(@PathVariable String examId) {
        examService.lockMarks(examId);
        return ResponseEntity.ok(ApiResponse.success(null, "Marks locked"));
    }

    @PatchMapping("/{examId}/unlock-marks")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> unlockMarks(@PathVariable String examId) {
        examService.unlockMarks(examId);
        return ResponseEntity.ok(ApiResponse.success(null, "Marks unlocked"));
    }
}
