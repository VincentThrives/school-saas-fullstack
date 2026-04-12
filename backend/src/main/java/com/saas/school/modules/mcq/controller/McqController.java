package com.saas.school.modules.mcq.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.mcq.model.*;
import com.saas.school.modules.mcq.service.McqService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@Tag(name="MCQ Exams")
@RestController
@RequestMapping("/api/v1/mcq")
@RequiredArgsConstructor
public class McqController {
    private final McqService mcqService;

    @PostMapping("/questions")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<McqQuestion>> createQuestion(
            @RequestBody McqQuestion q, @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.createQuestion(q, userId), "Created"));
    }
    @PostMapping("/exams")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<McqExam>> createExam(
            @RequestBody McqExam exam, @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.createExam(exam, userId), "Created"));
    }
    @PatchMapping("/exams/{examId}/publish")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<McqExam>> publish(@PathVariable String examId) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.publishExam(examId)));
    }
    @PostMapping("/exams/{examId}/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<McqResult>> start(
            @PathVariable String examId, @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.startAttempt(examId, userId)));
    }
    @PostMapping("/exams/{examId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<McqResult>> submit(
            @PathVariable String examId,
            @AuthenticationPrincipal String userId,
            @RequestBody List<Integer> answers) {
        return ResponseEntity.ok(ApiResponse.success(mcqService.submitExam(examId, userId, answers)));
    }
}