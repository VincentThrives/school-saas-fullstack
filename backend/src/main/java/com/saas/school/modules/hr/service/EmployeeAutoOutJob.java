package com.saas.school.modules.hr.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.hr.repository.EmployeeAttendanceSettingsRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * Stamps OUT on any {@link EmployeeAttendance} row that has an IN but
 * no OUT by the tenant's configured {@code autoOutTime}. Runs every
 * 15 min from 15:00–23:00 IST — the window that covers a typical
 * school-day end (15:00 for kids, 17:00–18:00 for teachers with prep)
 * and later evening shifts.
 *
 * <p>Opt-in per tenant via
 * {@link EmployeeAttendanceSettings#isAutoOutEnabled()} — off by
 * default so tenants that prefer regularization for missing OUTs
 * (audit trail preserved) aren't surprised by system-stamped rows.</p>
 *
 * <p>After stamping OUT, invokes
 * {@link EmployeeAttendanceService#applyHalfDayRule} so the half-day
 * threshold (hours-worked) fires the same way as a real OUT punch
 * would. Uses {@code MANUAL} source with an {@code auto-out} marker
 * on {@code markedByUserId} so audit-trail queries can identify
 * system-generated OUTs.</p>
 */
@Component
public class EmployeeAutoOutJob {

    private static final Logger log = LoggerFactory.getLogger(EmployeeAutoOutJob.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    /** Marker prefix on {@code markedByUserId} so audit tools can
     *  distinguish auto-generated OUTs from HR manual entries. */
    private static final String MARKER = "auto-out";

    @Autowired private TenantRepository tenantRepository;
    @Autowired private EmployeeAttendanceSettingsRepository settingsRepo;
    @Autowired private EmployeeAttendanceRepository attendanceRepo;

    /**
     * Hourly from 15:00–23:00 IST — cron field order is
     * "second minute hour day-of-month month day-of-week".
     *
     * <p>Cadence rationale: auto-OUT stamps once per (employee,
     * day). After that first stamp the row has an OUT set, so
     * every subsequent tick is a cheap no-op (the loop just
     * skips rows with a non-null outTime). Nine runs a day gives
     * us enough redundancy that a transient DB blip during one
     * run recovers within an hour, without the 32-runs-a-day
     * churn a 15-min cadence would produce.</p>
     *
     * <p>The 15–23 IST window covers a typical school-day end
     * (15:00 for students, 17:00–18:00 for teachers with prep)
     * and later evening shifts. Runs outside that window would
     * just no-op on every tenant.</p>
     */
    @Scheduled(cron = "0 0 15-23 * * *", zone = "Asia/Kolkata")
    public void tick() {
        List<Tenant> tenants;
        try {
            tenants = tenantRepository.findAll();
        } catch (Exception e) {
            log.error("Auto-OUT tick: could not enumerate tenants: {}", e.getMessage(), e);
            return;
        }
        for (Tenant tenant : tenants) {
            // Umbrella feature-flag gate — skip tenants that don't
            // have HR turned on at the super-admin level. Cheaper
            // than the settings lookup + matches the auto-absent
            // pattern (biometric_terminal flag check upstream).
            if (tenant.getFeatureFlags() == null
                    || !Boolean.TRUE.equals(tenant.getFeatureFlags().get("hr_module"))) {
                continue;
            }
            String previous = TenantContext.getTenantId();
            try {
                TenantContext.setTenantId(tenant.getTenantId());
                runForTenant(tenant);
            } catch (Exception e) {
                log.warn("Auto-OUT tick failed for tenant {}: {}",
                    tenant.getTenantId(), e.getMessage(), e);
            } finally {
                if (previous == null) TenantContext.clear();
                else TenantContext.setTenantId(previous);
            }
        }
    }

    /** Per-tenant body. Runs with TenantContext already set. */
    private void runForTenant(Tenant tenant) {
        EmployeeAttendanceSettings settings = settingsRepo
            .findAll().stream().findFirst().orElse(null);
        if (settings == null || !settings.isAutoOutEnabled()) return;

        LocalTime cutoff = parseTime(settings.getAutoOutTime());
        if (cutoff == null) {
            log.debug("Auto-OUT skip {}: autoOutTime invalid or blank",
                tenant.getTenantId());
            return;
        }
        LocalTime now = LocalTime.now(ZONE);
        // Only start stamping once the cutoff has passed for the
        // day — otherwise we'd race live employees who might still
        // punch OUT themselves.
        if (now.isBefore(cutoff)) return;

        LocalDate today = LocalDate.now(ZONE);
        Instant autoOutInstant = ZonedDateTime.of(today, cutoff, ZONE).toInstant();

        List<EmployeeAttendance> todaysRows = attendanceRepo.findByDate(today);
        int stamped = 0;
        for (EmployeeAttendance row : todaysRows) {
            if (row.getInTime() == null) continue;         // never came in
            if (row.getOutTime() != null) continue;        // already OUT
            if ("ABSENT".equalsIgnoreCase(row.getStatus())) continue;
            // Guardrail: don't stamp a row whose IN was AFTER the
            // auto-out cutoff (rare — employee walked in after the
            // day nominally ended). Their duration would be negative.
            if (row.getInTime().isAfter(autoOutInstant)) continue;

            row.setOutTime(autoOutInstant);
            row.setMarkedByUserId(MARKER + ":" + settings.getAutoOutTime());
            // Recompute HALF_DAY vs PRESENT using the tenant's
            // hours-worked rule — same helper as real OUT punches.
            EmployeeAttendanceService.applyHalfDayRule(row, settings);
            // Add a remark noting the auto-stamp so daily-view HR
            // can tell "these OUTs weren't real punches".
            String prefix = row.getRemarks() == null ? "" : row.getRemarks() + " · ";
            long hours = Duration.between(row.getInTime(), autoOutInstant).toHours();
            row.setRemarks(prefix + "Auto-stamped OUT at " + settings.getAutoOutTime()
                + " (" + hours + "h worked)");
            attendanceRepo.save(row);
            stamped++;
        }
        if (stamped > 0) {
            log.info("Auto-OUT: tenant={} date={} stamped={}",
                tenant.getTenantId(), today, stamped);
        }
    }

    private LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) return null;
        try { return LocalTime.parse(hhmm); }
        catch (Exception e) { return null; }
    }
}
