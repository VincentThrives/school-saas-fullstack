package com.saas.school.modules.otherassessment.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.otherassessment.dto.CreateOtherAssessmentRequest;
import com.saas.school.modules.otherassessment.dto.SaveMarksRequest;
import com.saas.school.modules.otherassessment.dto.UpdateOtherAssessmentRequest;
import com.saas.school.modules.otherassessment.model.OtherAssessment;
import com.saas.school.modules.otherassessment.service.OtherAssessmentNotifyService;
import com.saas.school.modules.otherassessment.service.OtherAssessmentService;
import com.saas.school.modules.otherassessment.service.OtherAssessmentTemplateService;
import com.saas.school.modules.otherassessment.service.OtherAssessmentUploadService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Other Assessments")
@RestController
@RequestMapping("/api/v1/other-assessments")
public class OtherAssessmentController {

    @Autowired private OtherAssessmentService service;
    @Autowired private OtherAssessmentTemplateService templateService;
    @Autowired private OtherAssessmentUploadService uploadService;
    @Autowired private OtherAssessmentNotifyService notifyService;

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessment>> create(
            @Valid @RequestBody CreateOtherAssessmentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.create(req, userId), "Assessment created"));
    }

    @GetMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<List<OtherAssessment>>> list(
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String sectionId,
            @RequestParam String academicYearId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(ApiResponse.success(
                service.list(classId, sectionId, academicYearId, type, archived)));
    }

    /** Un-archive a soft-deleted assessment — pushes it back into the
     *  live admin list. */
    @PostMapping("/{assessmentId}/restore")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessment>> restore(
            @PathVariable String assessmentId,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.restore(assessmentId, userId), "Restored"));
    }

    @GetMapping("/{assessmentId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessment>> get(@PathVariable String assessmentId) {
        return ResponseEntity.ok(ApiResponse.success(service.get(assessmentId)));
    }

    /** Student / parent view — every LIVE assessment the caller's
     *  student row appears in, most recent first, with only the
     *  caller's own marks (not peers'). */
    @GetMapping("/mine")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<List<OtherAssessmentService.StudentAssessmentView>>> mine(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.listForStudent(userId)));
    }

    @PutMapping("/{assessmentId}/marks")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessment>> saveMarks(
            @PathVariable String assessmentId,
            @Valid @RequestBody SaveMarksRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.saveMarks(assessmentId, req, userId), "Marks saved"));
    }

    /** Edit the date + subject list on an existing assessment. */
    @PutMapping("/{assessmentId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessment>> update(
            @PathVariable String assessmentId,
            @Valid @RequestBody UpdateOtherAssessmentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.update(assessmentId, req, userId), "Updated"));
    }

    /** Cheap lookup — powers the delete-confirmation dialog on the
     *  frontend so it can show a "marks already entered" warning
     *  without loading the entire assessment doc. */
    @GetMapping("/{assessmentId}/marks-status")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<java.util.Map<String, Boolean>>> marksStatus(
            @PathVariable String assessmentId) {
        boolean any = service.hasAnyMarksEntered(assessmentId);
        return ResponseEntity.ok(ApiResponse.success(
                java.util.Map.of("hasAnyMarks", any)));
    }

    /**
     * Streams the bulk-marks .xlsx template for the assessment —
     * pre-filled with school name, class label, roster, and the
     * subject columns. Admin fills marks, uploads back.
     */
    @GetMapping("/{assessmentId}/template")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<byte[]> downloadTemplate(
            @PathVariable String assessmentId,
            @RequestParam(defaultValue = "true") boolean includeRoll) {
        byte[] bytes = templateService.buildTemplate(assessmentId, includeRoll);
        String filename = templateService.buildFilename(assessmentId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        return new ResponseEntity<>(bytes, headers, org.springframework.http.HttpStatus.OK);
    }

    /**
     * Bulk-upload marks from a filled-in template. Matches students
     * by admission number (Roll No is intentionally ignored). Returns
     * a summary of matched / unmatched / invalid rows so the admin
     * can chase up any strays.
     */
    @PostMapping("/{assessmentId}/upload")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessmentUploadService.UploadResult>> uploadMarks(
            @PathVariable String assessmentId,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal String userId) {
        var result = uploadService.upload(assessmentId, file, userId);
        return ResponseEntity.ok(ApiResponse.success(result, "Marks uploaded"));
    }

    /**
     * Preview + send notification endpoints. Two-step so admin can
     * see the sample body + recipient counts before firing. Only
     * students with at least one mark are counted / notified.
     */
    @GetMapping("/{assessmentId}/notify/preview")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessmentNotifyService.NotifyPreview>> notifyPreview(
            @PathVariable String assessmentId) {
        return ResponseEntity.ok(ApiResponse.success(notifyService.preview(assessmentId)));
    }

    @PostMapping("/{assessmentId}/notify")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<OtherAssessmentNotifyService.NotifyResult>> notifySend(
            @PathVariable String assessmentId,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                notifyService.send(assessmentId, userId), "Notifications sent"));
    }

    /**
     * Delete an assessment. Default is soft-delete (archive) — the
     * row hides from the admin list but stays in the DB for later
     * restore / audit. Pass {@code ?hard=true} to remove it from
     * Mongo entirely.
     */
    @DeleteMapping("/{assessmentId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String assessmentId,
            @RequestParam(defaultValue = "false") boolean hard,
            @AuthenticationPrincipal String userId) {
        service.delete(assessmentId, hard, userId);
        return ResponseEntity.ok(ApiResponse.success(null,
                hard ? "Deleted permanently" : "Archived"));
    }
}
