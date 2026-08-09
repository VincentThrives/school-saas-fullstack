package com.saas.school.modules.biometricterminal.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometricterminal.dto.BiometricSettingsDto;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Read/write access to the current tenant's
 * {@link Tenant.BiometricSettings}. The settings live on the tenant
 * document itself (central DB), not a per-tenant collection, so reads
 * side-step the tenant-scoped Mongo factory.
 */
@Service
public class BiometricSettingsService {

    @Autowired private TenantRepository tenantRepository;

    public BiometricSettingsDto get() {
        Tenant tenant = requireTenant();
        Tenant.BiometricSettings settings = tenant.getBiometricSettings();
        if (settings == null) settings = new Tenant.BiometricSettings();
        return toDto(settings);
    }

    public BiometricSettingsDto save(BiometricSettingsDto req) {
        Tenant tenant = requireTenant();
        Tenant.BiometricSettings settings = tenant.getBiometricSettings();
        if (settings == null) settings = new Tenant.BiometricSettings();
        settings.setLateCutoff(req.getLateCutoff());
        settings.setEarliestExitTime(req.getEarliestExitTime());
        settings.setNotifyOnEntry(req.isNotifyOnEntry());
        settings.setNotifyOnExit(req.isNotifyOnExit());
        settings.setNotifyOnEarlyLeave(req.isNotifyOnEarlyLeave());
        tenant.setBiometricSettings(settings);
        tenantRepository.save(tenant);
        return toDto(settings);
    }

    private Tenant requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            throw new ResourceNotFoundException("Tenant", "no-tenant-context");
        }
        return tenantRepository.findById(tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
    }

    private BiometricSettingsDto toDto(Tenant.BiometricSettings s) {
        BiometricSettingsDto dto = new BiometricSettingsDto();
        dto.setLateCutoff(s.getLateCutoff());
        dto.setEarliestExitTime(s.getEarliestExitTime());
        dto.setNotifyOnEntry(s.isNotifyOnEntry());
        dto.setNotifyOnExit(s.isNotifyOnExit());
        dto.setNotifyOnEarlyLeave(s.isNotifyOnEarlyLeave());
        return dto;
    }
}
