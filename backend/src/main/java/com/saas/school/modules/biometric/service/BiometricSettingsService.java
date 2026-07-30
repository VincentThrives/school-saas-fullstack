package com.saas.school.modules.biometric.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometric.dto.BiometricSettingsRequest;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Tenant-scoped biometric settings — the switches that control card /
 * face / late cutoff for a school. Every read + write hops out of the
 * tenant DB context because {@link Tenant} lives in the master DB, then
 * restores the caller's tenant context on return.
 */
@Service
public class BiometricSettingsService {

    @Autowired private TenantRepository tenantRepository;

    /** Fetch the current tenant's biometric settings. Returns a fresh
     *  defaults object when the tenant has never configured them. */
    public Tenant.BiometricSettings get() {
        Tenant t = loadCurrentTenant();
        Tenant.BiometricSettings s = t.getBiometricSettings();
        return s != null ? s : new Tenant.BiometricSettings();
    }

    /** Save the settings for the current tenant. Rejects when both
     *  methods are off — a "no methods" tenant would just leave the
     *  kiosk deadlocked. */
    public Tenant.BiometricSettings save(BiometricSettingsRequest req) {
        if (req == null) throw new BusinessException("Settings body is required.");
        if (!req.isCardEnabled() && !req.isFaceEnabled()) {
            throw new BusinessException(
                    "At least one method (card or face) must be enabled.");
        }
        String tenantId = requireTenantId();
        return runInMasterDb(() -> {
            Tenant t = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
            Tenant.BiometricSettings s = t.getBiometricSettings();
            if (s == null) s = new Tenant.BiometricSettings();
            s.setCardEnabled(req.isCardEnabled());
            s.setFaceEnabled(req.isFaceEnabled());
            if (req.getLateCutoff() != null && !req.getLateCutoff().isBlank()) {
                s.setLateCutoff(req.getLateCutoff());
            }
            if (req.getOpenTime() != null && !req.getOpenTime().isBlank()) {
                s.setOpenTime(req.getOpenTime());
            }
            if (req.getFaceThreshold() != null) {
                s.setFaceThreshold(req.getFaceThreshold());
            }
            // Punch-in/out configuration.
            if (req.getExitTracking() != null && !req.getExitTracking().isBlank()) {
                String mode = req.getExitTracking().trim().toUpperCase();
                if (!mode.equals("OFF") && !mode.equals("AUTO") && !mode.equals("MANUAL")) {
                    throw new BusinessException("exitTracking must be OFF, AUTO, or MANUAL.");
                }
                s.setExitTracking(mode);
            }
            if (req.getEarliestExitTime() != null && !req.getEarliestExitTime().isBlank()) {
                s.setEarliestExitTime(req.getEarliestExitTime());
            }
            if (req.getNotifyOnEntry() != null) s.setNotifyOnEntry(req.getNotifyOnEntry());
            if (req.getNotifyOnExit() != null) s.setNotifyOnExit(req.getNotifyOnExit());
            if (req.getNotifyOnEarlyLeave() != null) s.setNotifyOnEarlyLeave(req.getNotifyOnEarlyLeave());
            t.setBiometricSettings(s);
            tenantRepository.save(t);
            return s;
        });
    }

    // ── Helpers ─────────────────────────────────────────────

    /** Tenant repo lives in the master DB; the tenant context resolver
     *  otherwise routes writes to the tenant DB and doesn't find the
     *  Tenant document. Clear + restore around the block. */
    private <T> T runInMasterDb(java.util.function.Supplier<T> block) {
        String saved = TenantContext.getTenantId();
        TenantContext.clear();
        try {
            return block.get();
        } finally {
            if (saved != null) TenantContext.setTenantId(saved);
        }
    }

    private Tenant loadCurrentTenant() {
        String tenantId = requireTenantId();
        return runInMasterDb(() -> tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId)));
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("No tenant context.");
        }
        return tenantId;
    }
}
