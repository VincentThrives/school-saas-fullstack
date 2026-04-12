package com.saas.school.modules.settings.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.settings.model.SchoolSettings;
import com.saas.school.modules.settings.repository.SchoolSettingsRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@Tag(name="School Settings")
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SCHOOL_ADMIN')")
public class SettingsController {
    private final SchoolSettingsRepository settingsRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<SchoolSettings>> get() {
        String tenantId = TenantContext.getTenantId();
        SchoolSettings settings = settingsRepo.findByTenantId(tenantId)
            .orElseGet(() -> SchoolSettings.builder()
                .settingsId(UUID.randomUUID().toString()).tenantId(tenantId)
                .maxLoginAttempts(5).attendanceWindowHours(2).lateThresholdMinutes(15)
                .defaultPassingMarksPercent(35).feeGracePeriodDays(7).sessionTimeoutMinutes(60)
                .passwordPolicy(SchoolSettings.PasswordPolicy.builder()
                    .minLength(8).requireUppercase(true).requireSpecialChar(true).expiryDays(90).build())
                .build());
        return ResponseEntity.ok(ApiResponse.success(settings));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<SchoolSettings>> update(@RequestBody SchoolSettings req) {
        req.setTenantId(TenantContext.getTenantId());
        if (req.getSettingsId() == null) req.setSettingsId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(settingsRepo.save(req)));
    }
}