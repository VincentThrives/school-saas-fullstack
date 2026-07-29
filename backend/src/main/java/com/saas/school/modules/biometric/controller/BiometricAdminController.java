package com.saas.school.modules.biometric.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.biometric.dto.BiometricSettingsRequest;
import com.saas.school.modules.biometric.dto.FaceEnrollmentRequest;
import com.saas.school.modules.biometric.dto.PairingCodeResponse;
import com.saas.school.modules.biometric.model.AttendanceScan;
import com.saas.school.modules.biometric.model.ScannerDevice;
import com.saas.school.modules.biometric.model.StudentBiometric;
import com.saas.school.modules.biometric.service.BiometricEnrollmentService;
import com.saas.school.modules.biometric.service.BiometricScanService;
import com.saas.school.modules.biometric.service.BiometricSettingsService;
import com.saas.school.modules.biometric.service.ScannerPairingService;
import com.saas.school.modules.tenant.model.Tenant;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin surface — settings, enrolment, device management. All endpoints
 * require {@code ROLE_SCHOOL_ADMIN} (or PRINCIPAL) authenticated via the
 * standard JWT. Feature-flag filter also gates by the tenant's
 * {@code biometric_attendance} flag.
 */
@Tag(name = "Biometric Attendance — Admin")
@RestController
@RequestMapping("/api/v1/biometric")
public class BiometricAdminController {

    @Autowired private BiometricSettingsService settingsService;
    @Autowired private BiometricEnrollmentService enrollmentService;
    @Autowired private ScannerPairingService pairingService;
    @Autowired private BiometricScanService scanService;

    // ── Settings ────────────────────────────────────────────

    @GetMapping("/settings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Tenant.BiometricSettings>> getSettings() {
        return ResponseEntity.ok(ApiResponse.success(settingsService.get()));
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Tenant.BiometricSettings>> saveSettings(
            @RequestBody BiometricSettingsRequest req) {
        return ResponseEntity.ok(ApiResponse.success(settingsService.save(req), "Settings saved"));
    }

    // ── Enrolment ───────────────────────────────────────────

    @PutMapping("/students/{studentId}/card")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Map<String, String>>> setCardUid(
            @PathVariable String studentId,
            @RequestBody Map<String, String> body) {
        enrollmentService.setCardUid(studentId, body == null ? null : body.get("cardUid"));
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("studentId", studentId, "cardUid", body == null ? "" : String.valueOf(body.get("cardUid"))),
                "Card mapped"));
    }

    @PutMapping("/students/{studentId}/face")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<StudentBiometric>> enrollFace(
            @PathVariable String studentId,
            @RequestBody FaceEnrollmentRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                enrollmentService.enrollFace(studentId, req, userId), "Face enrolled"));
    }

    @DeleteMapping("/students/{studentId}/face")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Void>> clearFace(@PathVariable String studentId) {
        enrollmentService.clearFace(studentId);
        return ResponseEntity.ok(ApiResponse.success(null, "Face enrolment removed"));
    }

    @GetMapping("/students/{studentId}/face")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<StudentBiometric>> getFace(@PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(enrollmentService.getFace(studentId)));
    }

    // ── Kiosk devices ───────────────────────────────────────

    @PostMapping("/devices/pairing-code")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PairingCodeResponse>> generatePairingCode(
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal String userId) {
        String label = body == null ? null : body.get("label");
        return ResponseEntity.ok(ApiResponse.success(
                pairingService.createPairingCode(label, userId),
                "Pairing code generated"));
    }

    @GetMapping("/devices")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<ScannerDevice>>> listDevices() {
        return ResponseEntity.ok(ApiResponse.success(pairingService.listMyDevices()));
    }

    @DeleteMapping("/devices/{deviceId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Void>> revokeDevice(
            @PathVariable String deviceId,
            @AuthenticationPrincipal String userId) {
        pairingService.revoke(deviceId, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Device revoked"));
    }

    // ── Live scans health ───────────────────────────────────

    @GetMapping("/scans/today")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<AttendanceScan>>> scansToday() {
        return ResponseEntity.ok(ApiResponse.success(scanService.listTodayScans()));
    }
}
