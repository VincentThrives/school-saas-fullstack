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
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
public class ReportCardController {

    private static final Logger logger = LoggerFactory.getLogger(ReportCardController.class);

    @Autowired
    private ReportCardService reportCardService;

    @GetMapping("/student/{studentId}")
    public ResponseEntity<ApiResponse<ReportCard>> getStudentReportCard(
            @PathVariable String studentId,
            @RequestParam String academicYearId) {
        logger.info("Request to get/generate report card: studentId={}, academicYearId={}", studentId, academicYearId);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(reportCard));
    }

    @GetMapping("/student/{studentId}/pdf")
    public ResponseEntity<byte[]> getStudentReportCardPdf(
            @PathVariable String studentId,
            @RequestParam String academicYearId,
            @RequestParam String tenantId) {
        logger.info("Request to generate report card PDF: studentId={}, academicYearId={}", studentId, academicYearId);
        ReportCard reportCard = reportCardService.generateReportCard(studentId, academicYearId);
        byte[] pdfBytes = reportCardService.generateReportCardPdf(reportCard.getId(), tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report_card_" + studentId + ".pdf")
                .body(pdfBytes);
    }

    @PostMapping("/class/{classId}/generate")
    public ResponseEntity<ApiResponse<List<ReportCard>>> generateClassReportCards(
            @PathVariable String classId,
            @RequestParam String academicYearId) {
        logger.info("Request to generate bulk report cards: classId={}, academicYearId={}", classId, academicYearId);
        List<ReportCard> reportCards = reportCardService.generateBulkReportCards(classId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(reportCards, "Report cards generated for " + reportCards.size() + " students"));
    }
}
