package com.saas.school.modules.biometricterminal.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.biometricterminal.dto.BiometricSettingsDto;
import com.saas.school.modules.biometricterminal.service.BiometricSettingsService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/biometric/settings")
@PreAuthorize("hasRole('SCHOOL_ADMIN')")
public class BiometricSettingsController {

    @Autowired private BiometricSettingsService settingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<BiometricSettingsDto>> get() {
        return ResponseEntity.ok(ApiResponse.success(settingsService.get()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<BiometricSettingsDto>> update(
            @Valid @RequestBody BiometricSettingsDto req) {
        return ResponseEntity.ok(ApiResponse.success(settingsService.save(req), "Settings updated"));
    }
}
