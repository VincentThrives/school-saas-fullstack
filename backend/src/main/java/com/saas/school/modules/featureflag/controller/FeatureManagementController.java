package com.saas.school.modules.featureflag.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.featureflag.dto.*;
import com.saas.school.modules.featureflag.model.FeatureAuditLog;
import com.saas.school.modules.featureflag.model.FeatureCatalog;
import com.saas.school.modules.featureflag.model.FeatureTemplate;
import com.saas.school.modules.featureflag.service.FeatureManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Feature Management")
@RestController
@RequestMapping("/api/v1/super/features")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class FeatureManagementController {

    private static final Logger log = LoggerFactory.getLogger(FeatureManagementController.class);

    @Autowired private FeatureManagementService featureManagementService;

    // ── Feature Catalog ───────────────────────────────────────────

    @Operation(summary = "Get full feature catalog")
    @GetMapping("/catalog")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<FeatureCatalog>>> getFeatureCatalog() {
        return ResponseEntity.ok(ApiResponse.success(featureManagementService.getFeatureCatalog()));
    }

    // ── School Features ───────────────────────────────────────────

    @Operation(summary = "Get school features with details")
    @GetMapping("/schools/{tenantId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolFeatureResponse>> getSchoolFeatures(@PathVariable String tenantId) {
        return ResponseEntity.ok(ApiResponse.success(featureManagementService.getSchoolFeatures(tenantId)));
    }

    @Operation(summary = "Toggle a single feature for a school")
    @PutMapping("/schools/{tenantId}/toggle")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> toggleFeature(
            @PathVariable String tenantId,
            @RequestBody FeatureToggleRequest request,
            Authentication authentication) {
        String adminId = (String) authentication.getPrincipal();
        String adminName = authentication.getName();
        return ResponseEntity.ok(ApiResponse.success(
                featureManagementService.toggleFeature(
                        tenantId, request.getFeatureKey(), request.isEnabled(),
                        request.getReason(), adminId, adminName),
                "Feature toggled successfully"));
    }

    @Operation(summary = "Bulk toggle features for a school")
    @PutMapping("/schools/{tenantId}/bulk")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> bulkToggleFeatures(
            @PathVariable String tenantId,
            @RequestBody BulkFeatureToggleRequest request,
            Authentication authentication) {
        String adminId = (String) authentication.getPrincipal();
        String adminName = authentication.getName();
        return ResponseEntity.ok(ApiResponse.success(
                featureManagementService.bulkToggleFeatures(
                        tenantId, request.getFeatures(), request.getReason(), adminId, adminName),
                "Features updated successfully"));
    }

    // ── Audit Log ─────────────────────────────────────────────────

    @Operation(summary = "Get feature audit log for a school")
    @GetMapping("/schools/{tenantId}/audit")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Page<FeatureAuditLog>>> getAuditLog(
            @PathVariable String tenantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                featureManagementService.getAuditLog(tenantId, PageRequest.of(page, size))));
    }

    @Operation(summary = "Undo a feature toggle within 5 minutes")
    @PostMapping("/schools/{tenantId}/audit/{auditId}/undo")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Boolean>> undoToggle(
            @PathVariable String tenantId,
            @PathVariable String auditId,
            Authentication authentication) {
        String adminId = (String) authentication.getPrincipal();
        String adminName = authentication.getName();
        return ResponseEntity.ok(ApiResponse.success(
                featureManagementService.undoToggle(auditId, adminId, adminName),
                "Toggle undone successfully"));
    }

    // ── Apply Template ────────────────────────────────────────────

    @Operation(summary = "Apply a feature template to a school")
    @PostMapping("/schools/{tenantId}/apply-template")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> applyTemplate(
            @PathVariable String tenantId,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String adminId = (String) authentication.getPrincipal();
        String adminName = authentication.getName();
        String templateId = request.get("templateId");
        return ResponseEntity.ok(ApiResponse.success(
                featureManagementService.applyTemplate(tenantId, templateId, adminId, adminName),
                "Template applied successfully"));
    }

    // ── Template CRUD ─────────────────────────────────────────────

    @Operation(summary = "List all feature templates")
    @GetMapping("/templates")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<FeatureTemplate>>> getTemplates() {
        return ResponseEntity.ok(ApiResponse.success(featureManagementService.getTemplates()));
    }

    @Operation(summary = "Create a feature template")
    @PostMapping("/templates")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<FeatureTemplate>> createTemplate(
            @RequestBody CreateTemplateRequest request,
            Authentication authentication) {
        String adminId = (String) authentication.getPrincipal();
        String adminName = authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        featureManagementService.createTemplate(request, adminId, adminName),
                        "Template created successfully"));
    }

    @Operation(summary = "Delete a feature template")
    @DeleteMapping("/templates/{templateId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteTemplate(@PathVariable String templateId) {
        featureManagementService.deleteTemplate(templateId);
        return ResponseEntity.ok(ApiResponse.success(null, "Template deleted successfully"));
    }
}
