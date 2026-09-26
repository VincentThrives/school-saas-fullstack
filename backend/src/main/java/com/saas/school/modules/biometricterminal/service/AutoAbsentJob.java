package com.saas.school.modules.biometricterminal.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.biometricterminal.model.AutoAbsentLog;
import com.saas.school.modules.biometricterminal.model.BiometricSettings;
import com.saas.school.modules.biometricterminal.repository.AutoAbsentLogRepository;
import com.saas.school.modules.biometricterminal.repository.BiometricSettingsRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import com.saas.school.modules.sms.service.SmsService;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
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
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Marks students who haven't scanned in by their tenant's configured
 * {@code absentAutoMarkTime} as ABSENT and fires an in-app notification
 * to the parent. Opt-in per tenant via
 * {@link BiometricSettings#isAbsentAutoMarkEnabled()} — default off, so
 * existing tenants don't get surprise auto-absent behavior when this
 * ships. Only runs against tenants that also have the
 * {@code biometric_terminal} feature flag on.
 *
 * <p>Runs every 15 minutes between 09:00 and 13:00 IST — the window
 * within which any Indian school's cutoff would fall. For each tenant
 * we check "has your absent-mark time passed today?" and idempotency
 * ("did we already run today?") before doing any work.</p>
 *
 * <p><b>Sunday / holiday guard.</b> The job silently skips if today is a
 * Sunday OR overlaps a declared HOLIDAY event on the school calendar
 * — a production-incident fix (schools without Sunday scans were
 * getting every student stamped absent + SMS-blasted). HR can override
 * this per-date by adding a WORKING_DAY event on the same School
 * Events page they use for holidays (Sunday make-up class, rescheduled
 * festival, extra exam day). The idempotency marker still gets written
 * so the 15-min cron doesn't re-evaluate the same day every tick.</p>
 *
 * <p>Fires SMS through the existing ABSENCE_ALERT flow (same DLT
 * template + audit + idempotency the manual "Send today's absent SMS"
 * button on the SMS Notifications page uses). Each newly-marked student
 * from this run is passed to {@link SmsService#sendAbsenceAlertsForToday}
 * with the caller id {@code SYSTEM_AUTO} so the audit log shows the
 * source. Wrapped in a broad catch so an SMS misconfig (globally off,
 * per-tenant off, MSG91 error) never fails the ABSENT-marking part of
 * the pass — in-app notifications still land regardless.</p>
 */
@Component
public class AutoAbsentJob {

    private static final Logger log = LoggerFactory.getLogger(AutoAbsentJob.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired private TenantRepository tenantRepository;
    @Autowired private BiometricSettingsRepository settingsRepository;
    @Autowired private AutoAbsentLogRepository logRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentsAttendanceRepository attendanceRepository;
    @Autowired private SchoolClassRepository classRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private SmsService smsService;
    /** SchoolEvent lookups drive the Sunday / holiday skip logic.
     *  Optional (required=false) so unit tests that stand up a bare
     *  auto-absent context without the events module still boot —
     *  the null-guarded helpers below fall back to "not a holiday
     *  / not a working-day override" when the repo is absent. */
    @Autowired(required = false) private SchoolEventRepository schoolEventRepository;

    /**
     * Every 15 min from 09:00–13:00 IST. Cron is second-field-first
     * ("second minute hour day-of-month month day-of-week"). No need
     * to run outside this window — no Indian school cutoff sits
     * outside 09:00–13:00.
     */
    @Scheduled(cron = "0 */15 9-13 * * *", zone = "Asia/Kolkata")
    public void tick() {
        List<Tenant> tenants;
        try {
            tenants = tenantRepository.findAll();
        } catch (Exception e) {
            log.error("Auto-absent tick: could not enumerate tenants: {}", e.getMessage(), e);
            return;
        }
        for (Tenant tenant : tenants) {
            if (tenant.getFeatureFlags() == null
                    || !Boolean.TRUE.equals(tenant.getFeatureFlags().get("biometric_terminal"))) {
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

    /** All logic below runs with TenantContext set to a single tenant. */
    private void runForTenant(Tenant tenant) {
        BiometricSettings settings = settingsRepository
            .findById(BiometricSettings.SINGLETON_ID)
            .orElse(null);
        if (settings == null || !settings.isAbsentAutoMarkEnabled()) return;

        LocalTime cutoff = parseTime(settings.getAbsentAutoMarkTime());
        if (cutoff == null) {
            log.debug("Auto-absent skip {}: absentAutoMarkTime invalid or blank", tenant.getTenantId());
            return;
        }
        LocalTime now = LocalTime.now(ZONE);
        if (now.isBefore(cutoff)) return; // cutoff hasn't hit today yet

        LocalDate today = LocalDate.now(ZONE);
        String todayKey = today.toString();
        if (logRepository.existsById(todayKey)) return; // already ran today

        // Sunday / holiday guards — critical fix for a production
        // incident where schools with biometric off on Sunday had every
        // student stamped absent and got SMS-blasted. Skip is
        // overridable via a WORKING_DAY event on the school calendar
        // (Sunday make-up class, rescheduled festival, exam day).
        // We still write the idempotency marker so the 15-min cron
        // doesn't re-evaluate this same day every tick.
        if (isNonWorkingDay(today, tenant.getTenantId())) {
            logRepository.save(new AutoAbsentLog(todayKey, 0, Instant.now()));
            return;
        }

        List<String> markedIds = markAbsentees(today);
        int marked = markedIds.size();
        logRepository.save(new AutoAbsentLog(todayKey, marked, Instant.now()));
        log.info("Auto-absent: tenant={} date={} marked={}",
            tenant.getTenantId(), todayKey, marked);
        fireAbsenceAlertSms(markedIds, tenant.getTenantId());
    }

    /**
     * True when today is a Sunday OR a declared holiday for the
     * current tenant, UNLESS the school has explicitly marked today
     * as a WORKING_DAY event on the school calendar (Sunday make-up,
     * rescheduled festival, extra exam day).
     *
     * <p>Signature takes {@code tenantId} only for the log line —
     * TenantContext is already set by the caller so repository
     * queries scope to the right tenant DB.</p>
     */
    private boolean isNonWorkingDay(LocalDate today, String tenantId) {
        boolean isSunday = today.getDayOfWeek() == DayOfWeek.SUNDAY;
        boolean isHoliday = isDeclaredHoliday(today);
        if (!isSunday && !isHoliday) return false;

        // Working-day override — HR marked today as a working day
        // even though it's a Sunday / previously a holiday. Run
        // auto-absent normally.
        if (hasWorkingDayOverride(today)) {
            log.info("Auto-absent: tenant={} date={} is {}{}, but has a WORKING_DAY override — running normally",
                tenantId, today,
                isSunday ? "Sunday" : "",
                isHoliday ? (isSunday ? " + holiday" : "holiday") : "");
            return false;
        }

        log.info("Auto-absent skip: tenant={} date={} reason={}",
            tenantId, today,
            isSunday && isHoliday ? "Sunday+holiday"
                : isSunday ? "Sunday"
                : "holiday");
        return true;
    }

    /** True when any HOLIDAY-typed SchoolEvent overlaps today. Empty
     *  / null-safe so a missing events collection just returns false. */
    private boolean isDeclaredHoliday(LocalDate today) {
        if (schoolEventRepository == null) return false;
        try {
            return !schoolEventRepository.findOverlappingHolidays(today, today).isEmpty();
        } catch (Exception e) {
            log.warn("Holiday lookup failed for {}: {}", today, e.getMessage());
            return false;
        }
    }

    /** True when any WORKING_DAY event overlaps today — HR's escape
     *  hatch to override the Sunday/holiday skip. */
    private boolean hasWorkingDayOverride(LocalDate today) {
        if (schoolEventRepository == null) return false;
        try {
            return !schoolEventRepository.findOverlappingWorkingDays(today, today).isEmpty();
        } catch (Exception e) {
            log.warn("Working-day-override lookup failed for {}: {}", today, e.getMessage());
            return false;
        }
    }

    /**
     * Manual trigger — bypasses the scheduled window + cutoff-time check
     * so admins can force a re-run mid-day (e.g., after adding a class
     * that was missed in the morning batch, or during testing outside
     * the 09:00–13:00 window). Still respects idempotency by DEFAULT
     * to prevent double-marking; the reset-log parameter lets admins
     * explicitly clear today's log for a true re-run.
     *
     * <p>The tenant must be resolved from TenantContext by the caller —
     * no cross-tenant iteration happens here (this is a per-tenant
     * admin endpoint, not a global tick).</p>
     *
     * @param resetLog when true, deletes today's idempotency row before
     *                 running so students already stamped by the earlier
     *                 auto-run don't block a fresh pass. Regular ABSENT
     *                 entries with a non-null status are still skipped
     *                 inside {@link #markAbsentees} — this only rewinds
     *                 the "did the job run today?" gate.
     * @return the number of students newly marked ABSENT this call
     */
    public int runNow(boolean resetLog) {
        BiometricSettings settings = settingsRepository
            .findById(BiometricSettings.SINGLETON_ID)
            .orElseGet(BiometricSettings::new);
        LocalDate today = LocalDate.now(ZONE);
        String todayKey = today.toString();
        if (resetLog && logRepository.existsById(todayKey)) {
            logRepository.deleteById(todayKey);
        }
        if (!resetLog && logRepository.existsById(todayKey)) {
            log.info("Manual auto-absent skipped — already ran today for this tenant. Pass resetLog=true to force.");
            return 0;
        }
        // Same Sunday / holiday guard as the scheduled tick — an admin
        // clicking "Run now" on a Sunday shouldn't be able to accidentally
        // trigger the exact production bug we're fixing. Working-day
        // override still lets a legitimate Sunday work session through.
        String currentTenantId = com.saas.school.config.mongodb.TenantContext.getTenantId();
        if (isNonWorkingDay(today, currentTenantId)) {
            logRepository.save(new AutoAbsentLog(todayKey, 0, Instant.now()));
            return 0;
        }
        List<String> markedIds = markAbsentees(today);
        int marked = markedIds.size();
        logRepository.save(new AutoAbsentLog(todayKey, marked, Instant.now()));
        log.info("Manual auto-absent complete: tenant={} date={} marked={} (enabled={})",
            com.saas.school.config.mongodb.TenantContext.getTenantId(),
            todayKey, marked, settings.isAbsentAutoMarkEnabled());
        fireAbsenceAlertSms(markedIds, com.saas.school.config.mongodb.TenantContext.getTenantId());
        return marked;
    }

    /** Scan every active student → for each without a PRESENT day-wise
     *  entry today, upsert an ABSENT entry and fire an in-app parent
     *  notification. Returns the studentIds newly marked absent so the
     *  caller can fan out the ABSENCE_ALERT SMS in one batched call.
     *
     *  <p>Skips any student whose class has today's day-of-week in
     *  {@link SchoolClass#getWeeklyOffDays()} — e.g. LKG/UKG on a
     *  Saturday when the main school still runs. No ABSENT stamp, no
     *  parent SMS for those classes.</p>
     */
    private List<String> markAbsentees(LocalDate today) {
        DayOfWeek dow = today.getDayOfWeek();
        // One classes-collection scan per run → then per-student
        // lookups are O(1). Empty / null off-day lists become empty
        // EnumSets so the .contains check is safe without further
        // null-guards.
        Map<String, Set<DayOfWeek>> offByClass = new HashMap<>();
        for (SchoolClass cls : classRepository.findAll()) {
            if (cls.getClassId() == null) continue;
            List<DayOfWeek> raw = cls.getWeeklyOffDays();
            Set<DayOfWeek> off = (raw == null || raw.isEmpty())
                ? EnumSet.noneOf(DayOfWeek.class)
                : EnumSet.copyOf(raw);
            offByClass.put(cls.getClassId(), off);
        }

        List<Student> students = studentRepository.findByDeletedAtIsNull();
        List<String> markedIds = new ArrayList<>();
        for (Student s : students) {
            if (s.getClassId() == null || s.getSectionId() == null) continue;

            // Per-class weekly-off (LKG has Saturday, main school
            // doesn't). No ABSENT stamp, no SMS. Silent skip — the
            // right behaviour is "this class isn't in session today."
            Set<DayOfWeek> off = offByClass.get(s.getClassId());
            if (off != null && off.contains(dow)) continue;

            StudentsAttendance row = attendanceRepository
                .findByClassIdAndSectionIdAndDateAndPeriodNumberAndSubjectIdAndComponentKeyAndSubPartKey(
                    s.getClassId(), s.getSectionId(), today, 0, null, null, null)
                .orElseGet(() -> {
                    StudentsAttendance fresh = new StudentsAttendance();
                    fresh.setClassId(s.getClassId());
                    fresh.setSectionId(s.getSectionId());
                    fresh.setAcademicYearId(s.getAcademicYearId());
                    fresh.setDate(today);
                    fresh.setPeriodNumber(0);
                    fresh.setEntries(new ArrayList<>());
                    fresh.setMarkedBy("AUTO_ABSENT");
                    return fresh;
                });
            if (row.getEntries() == null) row.setEntries(new ArrayList<>());
            StudentsAttendance.StudentEntry entry = row.getEntries().stream()
                .filter(e -> s.getStudentId().equals(e.getStudentId()))
                .findFirst()
                .orElse(null);

            // Don't touch a student who was already marked PRESENT
            // (biometric scan came through) or ABSENT (teacher already
            // handled it). Only fill in the missing entries.
            if (entry != null && entry.getStatus() != null) continue;

            if (entry == null) {
                entry = new StudentsAttendance.StudentEntry(
                    s.getStudentId(), "ABSENT", null);
                row.getEntries().add(entry);
            } else {
                entry.setStatus("ABSENT");
            }
            attendanceRepository.save(row);
            markedIds.add(s.getStudentId());
            fireParentNotification(s);
        }
        return markedIds;
    }

    /**
     * Fire ABSENCE_ALERT SMS for every student we just stamped ABSENT.
     * Delegates to the existing {@link SmsService#sendAbsenceAlertsForToday}
     * so the auto flow shares the same DLT template, per-tenant enable
     * flag ({@code TenantSmsSettings.absenceAlertEnabled}), audit trail,
     * and same-day dedup used by the manual "Send today's absent SMS"
     * button on the SMS Notifications page.
     *
     * <p>SmsService raises BusinessException when SMS is globally off,
     * the school hasn't been enabled, or absence alerts are toggled off
     * for the tenant. Those are configuration signals not errors — we
     * log at debug and let the ABSENT-marking side of the pass stand.
     * Any other exception is warned but similarly non-fatal.</p>
     */
    private void fireAbsenceAlertSms(List<String> studentIds, String tenantId) {
        if (studentIds == null || studentIds.isEmpty()) return;
        try {
            smsService.sendAbsenceAlertsForToday(studentIds, "SYSTEM_AUTO");
            log.info("Auto-absent SMS queued: tenant={} count={}", tenantId, studentIds.size());
        } catch (com.saas.school.common.exception.BusinessException e) {
            log.debug("Auto-absent SMS skipped for tenant {}: {}", tenantId, e.getMessage());
        } catch (Exception e) {
            log.warn("Auto-absent SMS failed for tenant {}: {}", tenantId, e.getMessage(), e);
        }
    }

    /** In-app push only for now — SMS wires in later once the DLT
     *  template is registered on the super-admin SMS panel. */
    private void fireParentNotification(Student s) {
        List<String> recipients = new ArrayList<>();
        if (s.getParentIds() != null && !s.getParentIds().isEmpty()) {
            recipients.addAll(s.getParentIds());
        } else if (s.getUserId() != null) {
            recipients.add(s.getUserId());
        }
        if (recipients.isEmpty()) return;

        String name = displayName(s);
        Notification n = new Notification();
        n.setTitle(name + " did not come to school today");
        n.setBody("No biometric arrival scan was recorded by the school's cutoff time. "
            + "Please contact the school if this looks wrong.");
        n.setType(Notification.NotificationType.ATTENDANCE);
        n.setChannel(Notification.Channel.IN_APP);
        n.setRecipientType(Notification.RecipientType.INDIVIDUAL);
        n.setRecipientIds(recipients);
        try {
            notificationService.send(n, "SYSTEM");
        } catch (Exception e) {
            log.warn("Auto-absent notify failed for student {}: {}",
                s.getStudentId(), e.getMessage());
        }
    }

    private String displayName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last  = s.getLastName() == null ? "" : s.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (s.getAdmissionNumber() != null) return "Student " + s.getAdmissionNumber();
        return "Your child";
    }

    private LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) return null;
        try { return LocalTime.parse(hhmm); }
        catch (Exception e) { return null; }
    }
}
