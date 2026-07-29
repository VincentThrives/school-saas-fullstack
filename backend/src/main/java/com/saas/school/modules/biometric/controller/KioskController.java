package com.saas.school.modules.biometric.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.biometric.dto.KioskRosterEntry;
import com.saas.school.modules.biometric.dto.PairDeviceRequest;
import com.saas.school.modules.biometric.dto.PairDeviceResponse;
import com.saas.school.modules.biometric.dto.ScanRequest;
import com.saas.school.modules.biometric.dto.ScanResponse;
import com.saas.school.modules.biometric.service.BiometricScanService;
import com.saas.school.modules.biometric.service.ScannerPairingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Kiosk-side endpoints. Two shapes:
 * <ul>
 *   <li><strong>Pair</strong> is public — a fresh tablet with no
 *       credentials calls it, so it's on {@link org.springframework.security.config.annotation.web.builders.HttpSecurity}'s
 *       {@code permitAll} list. Tenant is resolved from the request body's
 *       {@code schoolCode}.</li>
 *   <li><strong>Scan</strong> and <strong>Roster</strong> are gated by
 *       {@code ROLE_SCANNER}, granted by {@code ScannerDeviceAuthFilter}
 *       after resolving {@code X-Device-Token}.</li>
 * </ul>
 */
@Tag(name = "Biometric Attendance — Kiosk")
@RestController
@RequestMapping("/api/v1/biometric/kiosk")
public class KioskController {

    @Autowired private ScannerPairingService pairingService;
    @Autowired private BiometricScanService scanService;

    /**
     * Public. Fresh tablet redeems a pairing code + tenant identifier
     * and gets a long-lived device token back. Only reachable path
     * that doesn't require any prior auth on the tablet.
     */
    @PostMapping("/pair")
    public ResponseEntity<ApiResponse<PairDeviceResponse>> pair(
            @RequestBody PairDeviceRequest req,
            @RequestParam("schoolCode") String schoolCode) {
        return ResponseEntity.ok(ApiResponse.success(
                pairingService.redeemPairingCode(schoolCode, req),
                "Paired"));
    }

    /**
     * Device-token authenticated. The morning bundle used by the kiosk
     * to identify students locally without hitting the backend on every
     * face preview frame.
     */
    @GetMapping("/roster")
    @PreAuthorize("hasRole('SCANNER')")
    public ResponseEntity<ApiResponse<List<KioskRosterEntry>>> roster() {
        return ResponseEntity.ok(ApiResponse.success(scanService.buildRosterBundle()));
    }

    /**
     * Device-token authenticated. Every card tap or face match posts
     * here. Server returns a rich response the tablet uses to render
     * the welcome card immediately.
     */
    @PostMapping("/scan")
    @PreAuthorize("hasRole('SCANNER')")
    public ResponseEntity<ApiResponse<ScanResponse>> scan(
            @RequestBody ScanRequest req,
            HttpServletRequest http) {
        String deviceId = (String) http.getAttribute("scannerDeviceId");
        return ResponseEntity.ok(ApiResponse.success(scanService.scan(req, deviceId), "Scan recorded"));
    }
}
