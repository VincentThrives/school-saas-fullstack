package com.saas.school.modules.hr.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.hr.repository.EmployeeAttendanceSettingsRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Stamps ABSENT on any employee still unmarked past the tenant's
 * configured {@code autoAbsentTime}. Complements
 * {@link EmployeeAutoOutJob} (which stamps OUT for employees who
 * came in) — this one handles employees who never showed up at all,
 * so the HR report doesn't perpetually show "Unmarked" for a
 * no-show teacher.
 *
 * <p>Opt-in per tenant via
 * {@link EmployeeAttendanceSettings#isAutoAbsentEnabled()} — off by
 * default so existing tenants aren't surprised by system-generated
 * ABSENT rows. Also gated behind the {@code hr_module} feature flag
 * so tenants without HR don't get any employee-attendance behavior.</p>
 *
 * <p>Skips days that shouldn't count against the employee:
 * <ul>
 *   <li>Sundays — the default off-day</li>
 *   <li>Tenant-declared holidays (from {@link SchoolEvent} of type
 *       HOLIDAY)</li>
 *   <li>Employees with an existing row for today — regardless of
 *       status (ON_LEAVE, PRESENT, HALF_DAY, existing ABSENT). The
 *       leave workflow already writes ON_LEAVE rows on approval, so
 *       those are honored without extra logic here.</li>
 * </ul></p>
 */
@Component
public class EmployeeAutoAbsentJob {

    private static final Logger log = LoggerFactory.getLogger(EmployeeAutoAbsentJob.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    /** Marker prefix on {@code markedByUserId} so audit tools can
     *  distinguish system-generated ABSENT rows from HR manual entries. */
    private static final String MARKER = "auto-absent";
    /** How many hours after the tenant's cutoff the job stays
     *  active. 3 hours = 3 more hourly ticks after the cutoff, so a
     *  15:00 cutoff runs at 15:00, 16:00, 17:00, 18:00 — enough
     *  extra ticks that a late enrollment / regularization inside
     *  that window still gets its ABSENT stamp. Beyond the window
     *  every tick is a fast no-op. */
    private static final int AUTO_ABSENT_WINDOW_HOURS = 3;

    @Autowired private TenantRepository tenantRepository;
    @Autowired private EmployeeAttendanceSettingsRepository settingsRepo;
    @Autowired private EmployeeAttendanceRepository attendanceRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired(required = false) private SchoolEventRepository schoolEventRepo;

    /**
     * Hourly at :00 IST — 24 ticks a day, but each tenant only
     * actually processes ticks in the window
     * <code>[autoAbsentTime, autoAbsentTime + AUTO_ABSENT_WINDOW_HOURS]</code>.
     * A tenant with cutoff 15:00 runs at 15:00, 16:00, 17:00, 18:00 —
     * that's it. A tenant with cutoff 09:00 runs at 09:00, 10:00,
     * 11:00, 12:00. Ticks outside every tenant's window are cheap
     * no-ops that return before touching the DB.
     *
     * <p>Multiple ticks (not just one) so a late-arriving punch or
     * regularization inside the window still gets a chance — if HR
     * marks someone PRESENT at 15:30 for a 15:00 cutoff, the 16:00
     * tick won't re-mark them ABSENT (the row-exists check catches
     * it), and any employee who missed the 15:00 tick because they
     * were being enrolled gets caught on 16:00.</p>
     *
     * <p>The check "does this employee already have a row for today"
     * naturally handles half-day leaves too: an employee who punched
     * in for the morning (or has an approved ON_LEAVE for either
     * half of the day) already has a row, so this job leaves them
     * alone. Only the true no-shows get stamped ABSENT.</p>
     */
    @Scheduled(cron = "0 0 * * * *", zone = "Asia/Kolkata")
    public void tick() {
        List<Tenant> tenants;
        try {
            tenants = tenantRepository.findAll();
        } catch (Exception e) {
            log.error("Auto-absent tick: could not enumerate tenants: {}", e.getMessage(), e);
            return;
        }
        for (Tenant tenant : tenants) {
            // Umbrella HR flag — cheaper than the settings lookup +
            // matches the auto-out pattern.
            if (tenant.getFeatureFlags() == null
                    || !Boolean.TRUE.equals(tenant.getFeatureFlags().get("hr_module"))) {
                continue;
            }
            String previous = TenantContext.getTenantId();
            try {
                TenantContext.setTenantId(tenant.getTenantId());
                runForTenant(tenant);
            } catch (Exception e) {
                log.warn("Auto-absent tick failed for tenant {}: {}",
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
        if (settings == null || !settings.isAutoAbsentEnabled()) return;

        LocalTime cutoff = parseTime(settings.getAutoAbsentTime());
        if (cutoff == null) {
            log.debug("Auto-absent skip {}: autoAbsentTime invalid or blank",
                tenant.getTenantId());
            return;
        }
        LocalTime now = LocalTime.now(ZONE);
        // Only run inside [cutoff, cutoff + WINDOW_HOURS]. Before
        // the cutoff there's nothing to mark; after the window,
        // any remaining unmarked employees are HR's to sort out
        // (they may want to override with regularization / manual).
        if (now.isBefore(cutoff)) return;
        LocalTime windowEnd = cutoff.plusHours(AUTO_ABSENT_WINDOW_HOURS);
        // plusHours can wrap past midnight on late cutoffs — cap at
        // 23:59:59 so we don't wrap around and let the next day's
        // cron accidentally re-run against yesterday's data.
        if (windowEnd.isBefore(cutoff)) windowEnd = LocalTime.of(23, 59, 59);
        if (now.isAfter(windowEnd)) return;

        LocalDate today = LocalDate.now(ZONE);
        // Skip Sundays — the default off-day. Skipping holidays is
        // done below via the declared-holiday check.
        if (today.getDayOfWeek() == DayOfWeek.SUNDAY) return;
        if (isDeclaredHoliday(today)) return;

        Instant absentInstant = Instant.now();
        // Everyone the tenant has on the roster (soft-delete filtered
        // client-side — same pattern as elsewhere in HR because the
        // teacher list is small).
        List<Teacher> employees = teacherRepo.findAll().stream()
            .filter(t -> t.getDeletedAt() == null)
            .toList();
        if (employees.isEmpty()) return;

        // Existing rows for today — used to skip anyone who's already
        // stamped (ANY status: PRESENT, ON_LEAVE, ABSENT, etc.). The
        // ON_LEAVE case matters most: an approved-leave row is
        // written at approval time and this job must not overwrite it.
        Set<String> alreadyMarkedEmployeeIds = new HashSet<>();
        for (EmployeeAttendance row : attendanceRepo.findByDate(today)) {
            if (row.getEmployeeId() != null) {
                alreadyMarkedEmployeeIds.add(row.getEmployeeId());
            }
        }

        int stamped = 0;
        for (Teacher t : employees) {
            String empId = t.getTeacherId();
            if (empId == null) continue;
            if (alreadyMarkedEmployeeIds.contains(empId)) continue;

            EmployeeAttendance row = new EmployeeAttendance();
            row.setAttendanceId(UUID.randomUUID().toString());
            row.setEmployeeId(empId);
            row.setDate(today);
            row.setStatus("ABSENT");
            // Distinct source so the frontend can render "Auto-marked
            // absent" instead of "HR marked manually", and skip the
            // manual-entry corner-dot on the calendar.
            row.setSource("AUTO");
            row.setMarkedByUserId(MARKER + ":" + settings.getAutoAbsentTime());
            row.setCreatedAt(absentInstant);
            row.setUpdatedAt(absentInstant);
            row.setRemarks("Auto-marked ABSENT — no punch by "
                + settings.getAutoAbsentTime());
            try {
                attendanceRepo.save(row);
                stamped++;
            } catch (org.springframework.dao.DuplicateKeyException dup) {
                // Race with another writer on the same (employeeId,
                // date) unique index — someone marked them in between
                // our read and write. Skip silently.
            } catch (Exception e) {
                log.warn("Auto-absent failed to save row for employee {} tenant {}: {}",
                    empId, tenant.getTenantId(), e.getMessage());
            }
        }
        if (stamped > 0) {
            log.info("Auto-absent: tenant={} date={} stamped={}",
                tenant.getTenantId(), today, stamped);
        }
    }

    /** True when today falls on a tenant-declared HOLIDAY event.
     *  Falls back to false (no holiday) if the events module isn't
     *  wired — keeps the job running even in dev environments where
     *  the repo bean isn't loaded. */
    private boolean isDeclaredHoliday(LocalDate date) {
        if (schoolEventRepo == null) return false;
        try {
            List<SchoolEvent> events = schoolEventRepo.findOverlappingHolidays(date, date);
            for (SchoolEvent e : events) {
                LocalDate start = e.getStartDate();
                LocalDate end = e.getEndDate() != null ? e.getEndDate() : start;
                if (start == null) continue;
                if (!date.isBefore(start) && !date.isAfter(end)) return true;
            }
        } catch (Exception ex) {
            log.debug("Holiday lookup failed: {}", ex.getMessage());
        }
        return false;
    }

    private LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) return null;
        try { return LocalTime.parse(hhmm); }
        catch (Exception e) { return null; }
    }
}
