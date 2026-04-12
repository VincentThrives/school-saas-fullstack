package com.saas.school.modules.auth.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.auth.dto.*;
import com.saas.school.modules.auth.service.AuthService;
import com.saas.school.modules.superadmin.dto.TenantPublicInfo;
import com.saas.school.modules.tenant.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Authentication")
@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final TenantService tenantService;

    // ── Public Tenant Auth ─────────────────────────────────────────

    @Operation(summary = "Step 1: Resolve school by ID (public)")
    @PostMapping("/api/v1/auth/resolve-tenant")
    public ResponseEntity<ApiResponse<TenantPublicInfo>> resolveTenant(
            @Valid @RequestBody ResolveTenantRequest req) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.resolveTenant(req.getSchoolId())));
    }

    @Operation(summary = "Step 2: Login with tenantId + credentials (public)")
    @PostMapping("/api/v1/auth/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(req), "Login successful"));
    }

    @Operation(summary = "Refresh access token")
    @PostMapping("/api/v1/auth/refresh")
    public ResponseEntity<ApiResponse<TokenRefreshResponse>> refresh(
            @RequestHeader("X-Refresh-Token") String refreshToken) {
        return ResponseEntity.ok(ApiResponse.success(authService.refreshToken(refreshToken)));
    }

    @Operation(summary = "Logout (revokes refresh token)")
    @PostMapping("/api/v1/auth/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal String userId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String tenantId) {
        authService.logout(userId, tenantId);
        return ResponseEntity.ok(ApiResponse.success(null, "Logged out successfully"));
    }

    @Operation(summary = "Forgot password — sends reset email")
    @PostMapping("/api/v1/auth/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @RequestParam String email,
            @RequestParam String tenantId) {
        authService.forgotPassword(email, tenantId);
        // Always succeed — don't reveal if email exists
        return ResponseEntity.ok(ApiResponse.success(null,
                "If the email exists, a reset link has been sent."));
    }

    @Operation(summary = "Change password (authenticated)")
    @PostMapping("/api/v1/auth/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(userId, req.getOldPassword(), req.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed successfully"));
    }

    // ── Super Admin Auth ───────────────────────────────────────────

    @Operation(summary = "Super Admin login (separate endpoint — no School ID)")
    @PostMapping("/api/v1/super/auth/login")
    public ResponseEntity<ApiResponse<AuthResponse>> superAdminLogin(
            @Valid @RequestBody SuperAdminLoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
                authService.superAdminLogin(req), "Super admin login successful"));
    }

    @Operation(summary = "Super Admin token refresh")
    @PostMapping("/api/v1/super/auth/refresh")
    public ResponseEntity<ApiResponse<TokenRefreshResponse>> superAdminRefresh(
            @RequestHeader("X-Refresh-Token") String refreshToken) {
        return ResponseEntity.ok(ApiResponse.success(authService.refreshToken(refreshToken)));
    }

    @Operation(summary = "Super Admin logout")
    @PostMapping("/api/v1/super/auth/logout")
    public ResponseEntity<ApiResponse<Void>> superAdminLogout(
            @AuthenticationPrincipal String userId) {
        authService.logout(userId, null);
        return ResponseEntity.ok(ApiResponse.success(null, "Logged out successfully"));
    }
}
