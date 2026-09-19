package com.saas.school.modules.hr.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.hr.model.LeaveBalance;
import com.saas.school.modules.hr.model.LeaveType;
import com.saas.school.modules.hr.repository.LeaveBalanceRepository;
import com.saas.school.modules.hr.repository.LeaveTypeRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Monthly top-up job for {@code MONTHLY} and {@code QUARTERLY} leave
 * types. Walks every tenant's current-academic-year balances and, for
 * each row whose {@link LeaveBalance#getAccruedUnits() accruedUnits}
 * lags what today's date says the type should have credited so far,
 * bumps {@code allocated} by the missing slice and advances the
 * counter.
 *
 * <p>Two triggers:
 * <ol>
 *   <li>Cron @ 00:30 IST on the 1st of every month — the ordinary
 *       accrual tick, credits one month for MONTHLY types and one
 *       quarter (every third month) for QUARTERLY types.</li>
 *   <li>Startup catch-up ~2 minutes after boot — covers a tenant that
 *       spun up mid-month, or a server that was offline when a
 *       month rolled over. Uses the same idempotent math as the
 *       cron tick, so re-running never over-credits.</li>
 * </ol>
 *
 * <p>Idempotent by construction: the math re-derives the expected
 * cumulative units for today's date and only tops up the gap, so
 * running the job twice in the same month is a no-op the second time.
 * HR overrides that manually raised {@code allocated} above the
 * computed value are preserved — we only ever <em>add</em>, never
 * overwrite; overrides that intentionally lowered {@code allocated}
 * will be topped up next tick, which matches "override was a
 * one-time correction, accrual continues" semantics.</p>
 *
 * <p>{@code YEARLY} types provision with {@code accruedUnits=12} at
 * first touch and this job is a no-op for them.</p>
 */
@Component
public class LeaveAccrualJob {

    private static final Logger log = LoggerFactory.getLogger(LeaveAccrualJob.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired private TenantRepository tenantRepository;
    @Autowired private AcademicYearRepository academicYearRepo;
    @Autowired private LeaveTypeRepository typeRepo;
    @Autowired private LeaveBalanceRepository balanceRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private LeaveService leaveService;

    /** 00:30 IST on the 1st of every month. Cron field order is
     *  "second minute hour day-of-month month day-of-week". */
    @Scheduled(cron = "0 30 0 1 * *", zone = "Asia/Kolkata")
    public void monthlyTick() {
        log.info("Leave accrual monthly tick starting");
        runAll();
    }

    /** Startup catch-up — waits 2 minutes so DB / tenant caches are
     *  warm, then runs the same idempotent top-up. Covers the case
     *  where the server was offline when the 1st rolled over, or a
     *  new tenant was onboarded mid-month. */
    @Scheduled(initialDelay = 120_000, fixedDelay = Long.MAX_VALUE)
    public void startupCatchUp() {
        log.info("Leave accrual startup catch-up starting");
        runAll();
    }

    private void runAll() {
        List<Tenant> tenants;
        try {
            tenants = tenantRepository.findAll();
        } catch (Exception e) {
            log.error("Leave accrual: could not enumerate tenants: {}", e.getMessage(), e);
            return;
        }
        for (Tenant tenant : tenants) {
            // Skip tenants that don't have HR turned on. hr_leave is
            // the more specific gate but hr_module has to be true for
            // any of this to be reachable — check both to keep the
            // job consistent with the sidebar / route guards.
            if (tenant.getFeatureFlags() == null
                || !Boolean.TRUE.equals(tenant.getFeatureFlags().get("hr_module"))
                || !Boolean.TRUE.equals(tenant.getFeatureFlags().get("hr_leave"))) {
                continue;
            }
            String previous = TenantContext.getTenantId();
            try {
                TenantContext.setTenantId(tenant.getTenantId());
                runForTenant(tenant);
            } catch (Exception e) {
                log.warn("Leave accrual failed for tenant {}: {}",
                    tenant.getTenantId(), e.getMessage(), e);
            } finally {
                if (previous == null) TenantContext.clear();
                else TenantContext.setTenantId(previous);
            }
        }
    }

    private void runForTenant(Tenant tenant) {
        AcademicYear currentAy = academicYearRepo.findByIsCurrent(true).orElse(null);
        if (currentAy == null || currentAy.getStartDate() == null) {
            log.debug("Leave accrual skip {}: no current academic year", tenant.getTenantId());
            return;
        }
        String ayId = currentAy.getAcademicYearId();
        LocalDate today = LocalDate.now(ZONE);

        List<LeaveBalance> balances = balanceRepo.findByAcademicYearId(ayId);
        if (balances.isEmpty()) return;

        // Cache lookups so we don't re-hit Mongo per row.
        Map<String, LeaveType> typesByCode = new HashMap<>();
        for (LeaveType t : typeRepo.findAll()) typesByCode.put(t.getCode(), t);
        Map<String, Teacher> teachersById = new HashMap<>();
        for (Teacher t : teacherRepo.findAll()) teachersById.put(t.getTeacherId(), t);

        // The AY's month count is the denominator every top-up divides
        // by — a 10-month AY (Jun–Mar) credits annualQuota/10 per month
        // and rolls up to the FULL quota by the last month, not 10/12.
        int ayMonthCount = leaveService.academicYearMonthCount(ayId);

        int toppedUp = 0;
        for (LeaveBalance b : balances) {
            LeaveType type = typesByCode.get(b.getLeaveTypeCode());
            if (type == null) continue;                // orphaned code — skip
            Teacher emp = teachersById.get(b.getEmployeeId());
            String category = emp == null ? null : emp.getEmploymentCategory();
            LeaveType.CategoryPolicy policy = type.resolvePolicyFor(category);

            String accrualType = policy.getAccrualType();
            if (accrualType == null
                    || "YEARLY".equalsIgnoreCase(accrualType)) continue;

            int expected = leaveService.expectedAccruedUnits(accrualType, ayId, today);
            if (b.getAccruedUnits() >= expected) continue;     // already caught up

            int delta = expected - b.getAccruedUnits();
            double annualQuota = policy.getAnnualQuota();
            double addDays = annualQuota * (delta / (double) ayMonthCount);
            b.setAllocated(b.getAllocated() + addDays);
            b.setAccruedUnits(expected);
            b.setUpdatedAt(Instant.now());
            balanceRepo.save(b);
            toppedUp++;
            log.debug("Accrual top-up: tenant={} emp={} type={} +{}d units {}→{}/{}",
                tenant.getTenantId(), b.getEmployeeId(), b.getLeaveTypeCode(),
                addDays, expected - delta, expected, ayMonthCount);
        }
        if (toppedUp > 0) {
            log.info("Leave accrual: tenant={} ay={} rows-topped-up={}",
                tenant.getTenantId(), ayId, toppedUp);
        }
    }
}
