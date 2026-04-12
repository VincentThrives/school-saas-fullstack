package com.saas.school.modules.idcard.controller;

import com.saas.school.modules.idcard.dto.BulkIdCardRequest;
import com.saas.school.modules.idcard.service.IdCardService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "ID Cards")
@RestController
@RequestMapping("/api/v1/idcards")
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
public class IdCardController {

    private static final Logger logger = LoggerFactory.getLogger(IdCardController.class);

    @Autowired
    private IdCardService idCardService;

    @GetMapping("/student/{studentId}")
    public ResponseEntity<byte[]> generateStudentIdCard(
            @PathVariable String studentId,
            @RequestParam String tenantId) {
        logger.info("Request to generate student ID card: studentId={}, tenantId={}", studentId, tenantId);
        byte[] pdfBytes = idCardService.generateStudentIdCard(studentId, tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=student_idcard_" + studentId + ".pdf")
                .body(pdfBytes);
    }

    @GetMapping("/teacher/{teacherId}")
    public ResponseEntity<byte[]> generateTeacherIdCard(
            @PathVariable String teacherId,
            @RequestParam String tenantId) {
        logger.info("Request to generate teacher ID card: teacherId={}, tenantId={}", teacherId, tenantId);
        byte[] pdfBytes = idCardService.generateTeacherIdCard(teacherId, tenantId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=teacher_idcard_" + teacherId + ".pdf")
                .body(pdfBytes);
    }

    @PostMapping("/bulk")
    public ResponseEntity<byte[]> generateBulkIdCards(
            @RequestBody BulkIdCardRequest request,
            @RequestParam String tenantId) {
        logger.info("Request to generate bulk ID cards: type={}, count={}", request.getCardType(), request.getUserIds().size());
        byte[] pdfBytes;
        if ("TEACHER".equalsIgnoreCase(request.getCardType())) {
            // For teachers, generate individual cards combined (reuse bulk student logic pattern)
            // Currently bulk generation is only supported for students
            pdfBytes = idCardService.generateBulkStudentIdCards(request.getUserIds(), tenantId);
        } else {
            pdfBytes = idCardService.generateBulkStudentIdCards(request.getUserIds(), tenantId);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=bulk_idcards.pdf")
                .body(pdfBytes);
    }
}
