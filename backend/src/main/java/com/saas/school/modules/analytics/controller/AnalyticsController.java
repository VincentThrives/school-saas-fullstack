package com.saas.school.modules.analytics.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.analytics.dto.ClassRankingDto;
import com.saas.school.modules.analytics.dto.PerformanceTrendDto;
import com.saas.school.modules.analytics.dto.SubjectAnalysisDto;
import com.saas.school.modules.analytics.service.PerformanceAnalyticsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Analytics")
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    @Autowired
    private PerformanceAnalyticsService analyticsService;

    @GetMapping("/student/{studentId}/trend")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT')")
    public ResponseEntity<ApiResponse<List<PerformanceTrendDto>>> studentTrend(
            @PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getStudentTrend(studentId)));
    }

    @GetMapping("/class/{classId}/rankings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<ClassRankingDto>>> classRankings(
            @PathVariable String classId,
            @RequestParam String examId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getClassRankings(classId, examId)));
    }

    @GetMapping("/student/{studentId}/subjects")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT')")
    public ResponseEntity<ApiResponse<List<SubjectAnalysisDto>>> subjectAnalysis(
            @PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getSubjectAnalysis(studentId)));
    }

    @GetMapping("/class-comparison")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> classComparison(
            @RequestParam String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getClassComparison(academicYearId)));
    }

    @GetMapping("/class/{classId}/top-performers")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<ClassRankingDto>>> topPerformers(
            @PathVariable String classId,
            @RequestParam(defaultValue = "5") int count) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getTopPerformers(classId, count)));
    }
}
