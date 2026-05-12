package com.saas.school.modules.sms.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.sms.dto.TenantSmsSettingsDto;
import com.saas.school.modules.sms.dto.UpdateTenantSmsSettingsRequest;
import com.saas.school.modules.sms.model.TenantSmsSettings;
import com.saas.school.modules.sms.repository.CentralTenantSmsSettingsStore;
import com.saas.school.modules.sms.service.SmsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Super Admin SMS control panel — full mutate authority over
 * every tenant's SMS settings. Single role gate
 * ({@code SUPER_ADMIN}) on every endpoint.
 *
 * Lives under {@code /api/v1/super/sms/**} which is already
 * routed through the same SUPER_ADMIN-only filter chain as the
 * rest of the super-admin module.
 */
@Tag(name = "SMS — Super Admin")
@RestController
@RequestMapping("/api/v1/super/sms")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminSmsController {

    @Autowired private SmsService smsService;
    @Autowired private CentralTenantSmsSettingsStore settingsRepo;

    /** List every tenant's SMS config. Drives the Super Admin table view.
     *
     *  Returns empty list if no settings have been created yet — the
     *  frontend overlays defaults for tenants without rows so the admin
     *  sees the full list with everything OFF. */
    @GetMapping("/tenants")
    public ResponseEntity<ApiResponse<List<TenantSmsSettingsDto>>> listAllTenants() {
        List<TenantSmsSettingsDto> dtos = settingsRepo.findAll().stream()
                .map(TenantSmsSettingsDto::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }

    /** Fetch one tenant's settings — used by the per-tenant edit drawer. */
    @GetMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<TenantSmsSettingsDto>> getOne(
            @PathVariable String tenantId) {
        TenantSmsSettings s = smsService.getSettingsOrDefault(tenantId);
        return ResponseEntity.ok(ApiResponse.success(TenantSmsSettingsDto.from(s)));
    }

    /** Update one tenant — every field optional, only present ones applied. */
    @PutMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<TenantSmsSettingsDto>> updateOne(
            @PathVariable String tenantId,
            @Valid @RequestBody UpdateTenantSmsSettingsRequest req,
            @AuthenticationPrincipal String adminUserId) {
        TenantSmsSettings s = smsService.updateSettings(tenantId, req, adminUserId);
        return ResponseEntity.ok(ApiResponse.success(
                TenantSmsSettingsDto.from(s), "SMS settings updated for tenant " + tenantId));
    }

    /** Hard-delete one tenant's SMS settings row.
     *
     *  Distinct from PUT { enabled: false } — that just toggles the master
     *  switch but leaves the row (and its budget / trigger config) intact.
     *  DELETE removes the document entirely, so the tenant goes back to
     *  "no SMS settings exist" — which is the natural state for schools
     *  the platform never enabled SMS for. Useful for cleaning up orphaned
     *  rows (tenant deleted but settings linger) and for true off-boarding.
     *
     *  Returns 200 with a message even when the row didn't exist — idempotent
     *  by design so the frontend can call without first checking existence. */
    @DeleteMapping("/tenants/{tenantId}")
    public ResponseEntity<ApiResponse<Void>> deleteOne(
            @PathVariable String tenantId,
            @AuthenticationPrincipal String adminUserId) {
        long removed = smsService.deleteSettings(tenantId, adminUserId);
        String msg = removed > 0
                ? "SMS settings deleted for tenant " + tenantId
                : "No SMS settings existed for tenant " + tenantId;
        return ResponseEntity.ok(ApiResponse.success(null, msg));
    }
}
