package com.saas.school.modules.biometricterminal.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.biometricterminal.dto.BiometricSettingsDto;
import com.saas.school.modules.biometricterminal.service.AutoAbsentJob;
import com.saas.school.modules.biometricterminal.service.BiometricSettingsService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/biometric/settings")
@PreAuthorize("hasRole('SCHOOL_ADMIN')")
public class BiometricSettingsController {

    @Autowired private BiometricSettingsService settingsService;
    @Autowired private AutoAbsentJob autoAbsentJob;

    @GetMapping
    public ResponseEntity<ApiResponse<BiometricSettingsDto>> get() {
        return ResponseEntity.ok(ApiResponse.success(settingsService.get()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<BiometricSettingsDto>> update(
            @Valid @RequestBody BiometricSettingsDto req) {
        return ResponseEntity.ok(ApiResponse.success(settingsService.save(req), "Settings updated"));
    }

    /**
     * Manually trigger the auto-absent pass for the current tenant now,
     * bypassing the scheduled window + configured cutoff time. Useful
     * during testing (outside 09:00–13:00 IST) and for one-off admin
     * catch-up runs. Idempotent by default — pass {@code resetLog=true}
     * to force a re-run after today's log row already exists.
     */
    @PostMapping("/run-absent-now")
    public ResponseEntity<ApiResponse<Integer>> runAbsentNow(
            @RequestParam(value = "resetLog", defaultValue = "false") boolean resetLog) {
        int marked = autoAbsentJob.runNow(resetLog);
        return ResponseEntity.ok(ApiResponse.success(marked,
            "Auto-absent complete — " + marked + " student(s) marked ABSENT"));
    }
}
