package com.saas.school.modules.settings.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.settings.model.SchoolSettings;
import com.saas.school.modules.settings.repository.SchoolSettingsRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@Tag(name="School Settings")
@RestController
@RequestMapping("/api/v1/settings")
@PreAuthorize("hasRole('SCHOOL_ADMIN')")
public class SettingsController {
    @Autowired private SchoolSettingsRepository settingsRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<SchoolSettings>> get() {
        String tenantId = TenantContext.getTenantId();
        SchoolSettings settings = settingsRepo.findByTenantId(tenantId)
            .orElseGet(() -> {
                SchoolSettings.PasswordPolicy passwordPolicy = new SchoolSettings.PasswordPolicy();
                passwordPolicy.setMinLength(8);
                passwordPolicy.setRequireUppercase(true);
                passwordPolicy.setRequireSpecialChar(true);
                passwordPolicy.setExpiryDays(90);

                SchoolSettings defaults = new SchoolSettings();
                defaults.setSettingsId(UUID.randomUUID().toString());
                defaults.setTenantId(tenantId);
                defaults.setMaxLoginAttempts(5);
                defaults.setAttendanceWindowHours(2);
                defaults.setLateThresholdMinutes(15);
                defaults.setDefaultPassingMarksPercent(35);
                defaults.setFeeGracePeriodDays(7);
                defaults.setSessionTimeoutMinutes(60);
                defaults.setPasswordPolicy(passwordPolicy);
                return defaults;
            });
        return ResponseEntity.ok(ApiResponse.success(settings));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<SchoolSettings>> update(@RequestBody SchoolSettings req) {
        req.setTenantId(TenantContext.getTenantId());
        if (req.getSettingsId() == null) req.setSettingsId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(settingsRepo.save(req)));
    }
}