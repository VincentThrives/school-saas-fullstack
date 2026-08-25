package com.saas.school.modules.biometricterminal.service;

import com.saas.school.modules.biometricterminal.dto.BiometricSettingsDto;
import com.saas.school.modules.biometricterminal.model.BiometricSettings;
import com.saas.school.modules.biometricterminal.repository.BiometricSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Read/write access to the current tenant's biometric settings.
 * Settings live as a singleton document in the tenant's own DB —
 * no master-DB hop needed, TenantContext already routes us to the
 * right place.
 */
@Service
public class BiometricSettingsService {

    @Autowired private BiometricSettingsRepository repo;

    /** Fetch or return defaults if never saved. */
    public BiometricSettings getOrDefault() {
        return repo.findById(BiometricSettings.SINGLETON_ID)
                .orElseGet(BiometricSettings::new);
    }

    public BiometricSettingsDto get() {
        return toDto(getOrDefault());
    }

    public BiometricSettingsDto save(BiometricSettingsDto req) {
        BiometricSettings s = getOrDefault();
        s.setLateCutoff(req.getLateCutoff());
        s.setEarliestExitTime(req.getEarliestExitTime());
        s.setExpectedScansPerDay(req.getExpectedScansPerDay());
        s.setAbsentAutoMarkTime(req.getAbsentAutoMarkTime());
        s.setAbsentAutoMarkEnabled(req.isAbsentAutoMarkEnabled());
        s.setNotifyOnEntry(req.isNotifyOnEntry());
        s.setNotifyOnExit(req.isNotifyOnExit());
        s.setNotifyOnEarlyLeave(req.isNotifyOnEarlyLeave());
        return toDto(repo.save(s));
    }

    private BiometricSettingsDto toDto(BiometricSettings s) {
        BiometricSettingsDto dto = new BiometricSettingsDto();
        dto.setLateCutoff(s.getLateCutoff());
        dto.setEarliestExitTime(s.getEarliestExitTime());
        dto.setExpectedScansPerDay(s.getExpectedScansPerDay());
        dto.setAbsentAutoMarkTime(s.getAbsentAutoMarkTime());
        dto.setAbsentAutoMarkEnabled(s.isAbsentAutoMarkEnabled());
        dto.setNotifyOnEntry(s.isNotifyOnEntry());
        dto.setNotifyOnExit(s.isNotifyOnExit());
        dto.setNotifyOnEarlyLeave(s.isNotifyOnEarlyLeave());
        return dto;
    }
}
