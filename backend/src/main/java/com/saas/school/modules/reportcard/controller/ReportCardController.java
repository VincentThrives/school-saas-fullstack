package com.saas.school.modules.reportcard.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.reportcard.model.ReportCard;
import com.saas.school.modules.reportcard.service.ReportCardService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Report Cards")
@RestController
@RequestMapping("/api/v1/report-cards")
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER','STUDENT')")
public class ReportCardController {

    private static final Logger logger = LoggerFactory.getLogger(ReportCardController.class);

    @Autowired
    private ReportCardService reportCardService;

    @Autowired
    private com.saas.school.modules.student.repository.StudentRepository studentRepository;

    /** Student-self endpoint: resolve their studentId from JWT and return their card. */
    @GetMapping("/student/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<ReportCard>> getMyReportCard(
            @org.springframework.security.core.annotation.AuthenticationPrincipal String userId,
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        String studentId = resolveOwnStudentId(userId);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId, examType);
        return ResponseEntity.ok(ApiResponse.success(reportCard));
    }

    /** Student-self PDF download. */
    @GetMapping("/student/me/pdf")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<byte[]> getMyReportCardPdf(
            @org.springframework.security.core.annotation.AuthenticationPrincipal String userId,
            @RequestParam String academicYearId,
            @RequestParam String tenantId,
            @RequestParam String examType) {
        String studentId = resolveOwnStudentId(userId);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId, examType);
        byte[] pdfBytes = reportCardService.generateReportCardPdf(reportCard.getId(), tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report_card_" + studentId + ".pdf")
                .body(pdfBytes);
    }

    private String resolveOwnStudentId(String userId) {
        return studentRepository.findByUserIdAndDeletedAtIsNull(userId)
                .map(s -> s.getStudentId())
                .orElseThrow(() -> new com.saas.school.common.exception.ResourceNotFoundException("Student", userId));
    }

    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<ReportCard>> getStudentReportCard(
            @PathVariable String studentId,
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        logger.info("Request to get/generate report card: studentId={}, academicYearId={}, examType={}", studentId, academicYearId, examType);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId, examType);
        return ResponseEntity.ok(ApiResponse.success(reportCard));
    }

    @GetMapping("/student/{studentId}/pdf")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<byte[]> getStudentReportCardPdf(
            @PathVariable String studentId,
            @RequestParam String academicYearId,
            @RequestParam String tenantId,
            @RequestParam String examType) {
        logger.info("Request to generate report card PDF: studentId={}, academicYearId={}, examType={}", studentId, academicYearId, examType);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId, examType);
        byte[] pdfBytes = reportCardService.generateReportCardPdf(reportCard.getId(), tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report_card_" + studentId + ".pdf")
                .body(pdfBytes);
    }

    @PostMapping("/class/{classId}/generate")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<ReportCard>>> generateClassReportCards(
            @PathVariable String classId,
            @RequestParam String academicYearId,
            @RequestParam String examType) {
        logger.info("Request to generate bulk report cards: classId={}, academicYearId={}, examType={}", classId, academicYearId, examType);
        List<ReportCard> reportCards = reportCardService.generateBulkReportCards(classId, academicYearId, examType);
        return ResponseEntity.ok(ApiResponse.success(reportCards, "Report cards generated for " + reportCards.size() + " students"));
    }

    @GetMapping("/class/{classId}/pdf")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<byte[]> downloadAllClassReportCards(
            @PathVariable String classId,
            @RequestParam String academicYearId,
            @RequestParam String tenantId,
            @RequestParam String examType) {
        logger.info("Request to download all report card PDFs: classId={}, academicYearId={}, examType={}", classId, academicYearId, examType);
        byte[] zipBytes = reportCardService.generateBulkPdf(classId, academicYearId, examType, tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report_cards_class.zip")
                .body(zipBytes);
    }
}
