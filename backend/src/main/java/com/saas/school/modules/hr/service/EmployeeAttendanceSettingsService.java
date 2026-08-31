package com.saas.school.modules.hr.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.hr.dto.UpdateAttendanceSettingsRequest;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.repository.EmployeeAttendanceSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Owns reads + writes on {@link EmployeeAttendanceSettings}. Lazy
 * upsert on first read means new tenants don't need a seed step —
 * the defaults on the model itself are the sensible starting state.
 */
@Service
public class EmployeeAttendanceSettingsService {

    @Autowired private EmployeeAttendanceSettingsRepository repo;

    /** Returns the tenant's settings; creates + persists a default
     *  row on the fly when this is the first read. Safe to call from
     *  the hot path — subsequent calls hit the existing document. */
    public EmployeeAttendanceSettings getOrCreate() {
        String tenantId = TenantContext.getTenantId();
        return repo.findByTenantId(tenantId).orElseGet(() -> {
            EmployeeAttendanceSettings s = new EmployeeAttendanceSettings(tenantId);
            s.setId(UUID.randomUUID().toString());
            s.setUpdatedAt(Instant.now());
            return repo.save(s);
        });
    }

    /** Read-only variant — used by the auto-absent job path where a
     *  first-time-read from a scheduled thread shouldn't quietly
     *  create a document (that would surprise admins with an empty
     *  row appearing without them touching the settings page). */
    public EmployeeAttendanceSettings getOrDefault() {
        String tenantId = TenantContext.getTenantId();
        return repo.findByTenantId(tenantId)
                .orElseGet(() -> new EmployeeAttendanceSettings(tenantId));
    }

    /**
     * Apply a partial patch — only the non-null fields on the request
     * are written onto the persisted document. Keeps the existing
     * settings intact when the HR admin toggles a single switch.
     */
    public EmployeeAttendanceSettings update(UpdateAttendanceSettingsRequest req, String userId) {
        EmployeeAttendanceSettings s = getOrCreate();

        if (req.getLocationBasedEnabled() != null)   s.setLocationBasedEnabled(req.getLocationBasedEnabled());
        if (req.getBiometricBasedEnabled() != null)  s.setBiometricBasedEnabled(req.getBiometricBasedEnabled());

        if (req.getCampusLatitude() != null)         s.setCampusLatitude(req.getCampusLatitude());
        if (req.getCampusLongitude() != null)        s.setCampusLongitude(req.getCampusLongitude());
        if (req.getAllowedRadiusMeters() != null)    s.setAllowedRadiusMeters(req.getAllowedRadiusMeters());
        if (req.getRejectMockLocations() != null)    s.setRejectMockLocations(req.getRejectMockLocations());
        if (req.getMaxAccuracyMeters() != null)      s.setMaxAccuracyMeters(req.getMaxAccuracyMeters());

        if (req.getExpectedPunchesPerDay() != null)  s.setExpectedPunchesPerDay(req.getExpectedPunchesPerDay());
        if (req.getLateThreshold() != null)          s.setLateThreshold(req.getLateThreshold());
        if (req.getHalfDayThreshold() != null)       s.setHalfDayThreshold(req.getHalfDayThreshold());
        if (req.getAutoAbsentTime() != null)         s.setAutoAbsentTime(req.getAutoAbsentTime());
        if (req.getAutoAbsentEnabled() != null)      s.setAutoAbsentEnabled(req.getAutoAbsentEnabled());

        if (req.getRegularizationEnabled() != null)              s.setRegularizationEnabled(req.getRegularizationEnabled());
        if (req.getRegularizationMaxBackdateDays() != null)      s.setRegularizationMaxBackdateDays(req.getRegularizationMaxBackdateDays());
        if (req.getRegularizationMonthlyCapPerEmployee() != null) s.setRegularizationMonthlyCapPerEmployee(req.getRegularizationMonthlyCapPerEmployee());
        if (req.getRegularizationAutoApproveWindowMinutes() != null) s.setRegularizationAutoApproveWindowMinutes(req.getRegularizationAutoApproveWindowMinutes());

        s.setUpdatedAt(Instant.now());
        s.setUpdatedByUserId(userId);
        return repo.save(s);
    }
}
