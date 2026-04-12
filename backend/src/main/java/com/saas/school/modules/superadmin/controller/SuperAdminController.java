package com.saas.school.modules.superadmin.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.superadmin.dto.*;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Super Admin - Tenant Management")
@RestController
@RequestMapping("/api/v1/super")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    @Autowired private TenantService tenantService;

    // ── Tenant CRUD ────────────────────────────────────────────────

    @Operation(summary = "List all tenants (paginated)")
    @GetMapping("/tenants")
    public ResponseEntity<ApiResponse<PageResponse<Tenant>>> listTenants(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Tenant.TenantStatus status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(
                ApiResponse.success(tenantService.listTenants(page, size, status, search)));
    }

    @Operation(summary = "Get tenant details")
    @GetMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<Tenant>> getTenant(@PathVariable String tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getTenant(tenantId)));
    }

    @Operation(summary = "Create and provision a new tenant")
    @PostMapping("/tenants")
    public ResponseEntity<ApiResponse<Tenant>> createTenant(
            @Valid @RequestBody CreateTenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(tenantService.createTenant(request), "Tenant provisioned successfully"));
    }

    @Operation(summary = "Update tenant metadata")
    @PutMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<Tenant>> updateTenant(
            @PathVariable String tenantId,
            @Valid @RequestBody UpdateTenantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.updateTenant(tenantId, request)));
    }

    @Operation(summary = "Change tenant status (ACTIVE/INACTIVE/SUSPENDED)")
    @PatchMapping("/tenants/{tenantId}/status")
    public ResponseEntity<ApiResponse<Void>> changeTenantStatus(
            @PathVariable String tenantId,
            @Valid @RequestBody ChangeTenantStatusRequest request) {
        tenantService.changeTenantStatus(tenantId, request.getStatus(), request.getReason());
        return ResponseEntity.ok(ApiResponse.success(null, "Status updated"));
    }

    @Operation(summary = "Soft delete a tenant")
    @DeleteMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<Void>> deleteTenant(@PathVariable String tenantId) {
        tenantService.softDeleteTenant(tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Tenant deleted"));
    }

    @Operation(summary = "Global stats dashboard")
    @GetMapping("/tenants/stats")
    public ResponseEntity<ApiResponse<GlobalStatsDto>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getGlobalStats()));
    }

    // ── Feature Flags ──────────────────────────────────────────────

    @Operation(summary = "Get all feature flags for a tenant")
    @GetMapping("/tenants/{tenantId}/features")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getFeatures(
            @PathVariable String tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getFeatureFlags(tenantId)));
    }

    @Operation(summary = "Enable a feature for a tenant")
    @PatchMapping("/tenants/{tenantId}/features/{featureKey}/enable")
    public ResponseEntity<ApiResponse<Void>> enableFeature(
            @PathVariable String tenantId,
            @PathVariable String featureKey) {
        tenantService.enableFeature(tenantId, featureKey);
        return ResponseEntity.ok(ApiResponse.success(null, "Feature enabled"));
    }

    @Operation(summary = "Disable a feature for a tenant")
    @PatchMapping("/tenants/{tenantId}/features/{featureKey}/disable")
    public ResponseEntity<ApiResponse<Void>> disableFeature(
            @PathVariable String tenantId,
            @PathVariable String featureKey) {
        tenantService.disableFeature(tenantId, featureKey);
        return ResponseEntity.ok(ApiResponse.success(null, "Feature disabled"));
    }

    @Operation(summary = "Bulk update feature flags")
    @PutMapping("/tenants/{tenantId}/features")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> bulkUpdateFeatures(
            @PathVariable String tenantId,
            @RequestBody Map<String, Boolean> updates) {
        return ResponseEntity.ok(ApiResponse.success(
                tenantService.bulkUpdateFeatures(tenantId, updates)));
    }

    // ── Plan Management ────────────────────────────────────────────

    @Operation(summary = "Change subscription plan")
    @PutMapping("/tenants/{tenantId}/plan")
    public ResponseEntity<ApiResponse<Tenant>> changePlan(
            @PathVariable String tenantId,
            @RequestParam Tenant.SubscriptionPlan plan) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.changePlan(tenantId, plan)));
    }
}
