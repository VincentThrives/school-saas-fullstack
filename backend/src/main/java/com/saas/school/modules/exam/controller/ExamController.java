package com.saas.school.modules.exam.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.exam.dto.EnterMarksRequest;
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
@Tag(name="Exams")
@RestController
@RequestMapping("/api/v1/exams")
public class ExamController {
    @Autowired private ExamService examService;
    @Autowired private ExamMarkRepository markRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Exam>>> list(
            @RequestParam(required=false) String classId,
            @RequestParam(required=false) String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(examService.listExams(classId, academicYearId)));
    }
    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Exam>> create(@RequestBody Exam req) {
        return ResponseEntity.ok(ApiResponse.success(examService.createExam(req), "Exam created"));
    }
    @PostMapping("/marks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<List<ExamMark>>> enterMarks(
            @Valid @RequestBody EnterMarksRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(examService.enterMarks(req, userId)));
    }
    @GetMapping("/{examId}/marks")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<ExamMark>>> getMarks(@PathVariable String examId) {
        return ResponseEntity.ok(ApiResponse.success(markRepository.findByExamId(examId)));
    }
    @PatchMapping("/{examId}/lock-marks")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> lockMarks(@PathVariable String examId) {
        examService.lockMarks(examId);
        return ResponseEntity.ok(ApiResponse.success(null, "Marks locked"));
    }
}