package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.hr.dto.LeaveTypeDto;
import com.saas.school.modules.hr.dto.UpsertLeaveTypeRequest;
import com.saas.school.modules.hr.model.LeaveType;
import com.saas.school.modules.hr.repository.LeaveTypeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * CRUD for leave types + first-run seeder. Kept separate from
 * {@link LeaveService} so the tenant-provisioning side of the leave
 * domain (types + their default quotas) stays cleanly split from the
 * workflow side (applications + balances).
 */
@Service
public class LeaveTypeService {

    private static final Logger log = LoggerFactory.getLogger(LeaveTypeService.class);

    /** Starter set for a new tenant. Each has sensible policy defaults
     *  the school can then tune from the Leave Settings UI. */
    private static LeaveType[] buildDefaults() {
        LeaveType cl = new LeaveType(null, "CL", "Casual leave", 12, true, 100);
        cl.setDescription("Short informal leave for personal matters — usually 1-3 days.");
        cl.setColor("#3b82f6");                 // blue
        cl.setMaxConsecutiveDays(3);
        cl.setMinAdvanceDays(1);

        LeaveType sl = new LeaveType(null, "SL", "Sick leave", 10, true, 200);
        sl.setDescription("Leave for illness — no advance notice required.");
        sl.setColor("#ef4444");                 // red
        sl.setRequiresAttachmentAfterDays(3);   // medical cert after 3 days

        LeaveType el = new LeaveType(null, "EL", "Earned / Privileged leave", 15, true, 300);
        el.setDescription("Annual entitlement — carries forward, encourages planned breaks.");
        el.setColor("#10b981");                 // green
        el.setCarryForward(true);
        el.setCarryForwardMax(30);
        el.setMinAdvanceDays(7);
        el.setMandatoryPerYear(5);              // schools often want 5-day min break

        LeaveType mat = new LeaveType(null, "MAT", "Maternity leave", 180, true, 400);
        mat.setDescription("Statutory maternity leave — 26 weeks.");
        mat.setColor("#a855f7");                // purple
        mat.setApplicableGender("FEMALE");

        LeaveType pat = new LeaveType(null, "PAT", "Paternity leave", 15, true, 500);
        pat.setDescription("Leave around the birth of a child.");
        pat.setColor("#0ea5e9");                // sky
        pat.setApplicableGender("MALE");

        LeaveType lop = new LeaveType(null, "LOP", "Loss of pay", 0, false, 900);
        lop.setDescription("Unpaid leave once other balances are exhausted.");
        lop.setColor("#64748b");                // slate

        return new LeaveType[] { cl, sl, el, mat, pat, lop };
    }

    @Autowired private LeaveTypeRepository repo;

    /** Idempotent — no-op if any type already exists for the current
     *  tenant. Called from {@code DataInitializer} on tenant provision. */
    public void seedDefaultsIfEmpty() {
        if (repo.count() > 0) return;
        String tenantId = TenantContext.getTenantId();
        LeaveType[] defaults = buildDefaults();
        for (LeaveType tpl : defaults) {
            tpl.setTenantId(tenantId);
            repo.save(tpl);
        }
        log.info("Seeded {} default leave types for tenant {}", defaults.length, tenantId);
    }

    public List<LeaveTypeDto> listAll() {
        return repo.findAllByOrderBySortOrderAscNameAsc().stream()
            .map(LeaveTypeDto::fromEntity).toList();
    }

    public List<LeaveTypeDto> listActive() {
        return repo.findByActiveTrueOrderBySortOrderAscNameAsc().stream()
            .map(LeaveTypeDto::fromEntity).toList();
    }

    public LeaveTypeDto create(UpsertLeaveTypeRequest req) {
        if (req == null || req.getCode() == null || req.getCode().isBlank()) {
            throw new BusinessException("Code is required.");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new BusinessException("Name is required.");
        }
        String code = req.getCode().trim().toUpperCase();
        if (code.length() < 2 || code.length() > 8) {
            throw new BusinessException("Code must be 2–8 characters.");
        }
        if (repo.findByCode(code).isPresent()) {
            throw new BusinessException("Leave type '" + code + "' already exists.");
        }
        LeaveType t = new LeaveType(
            TenantContext.getTenantId(), code, req.getName().trim(),
            req.getDefaultAnnualQuota() != null ? req.getDefaultAnnualQuota() : 0.0,
            req.getPaid() == null || req.getPaid(),
            req.getSortOrder() != null ? req.getSortOrder() : 500);
        applyOptional(t, req);
        LeaveType saved = repo.save(t);
        log.info("Leave type created: code={} name={}", saved.getCode(), saved.getName());
        return LeaveTypeDto.fromEntity(saved);
    }

    /** Fold every optional / policy field from the request onto the
     *  entity. Central so create + update stay consistent — same
     *  ignore-null behaviour, same normalisation for enum-shaped
     *  strings (accrualType, applicableGender). */
    private void applyOptional(LeaveType t, UpsertLeaveTypeRequest req) {
        if (req.getDescription() != null) t.setDescription(req.getDescription().trim());
        if (req.getColor() != null) t.setColor(req.getColor().trim());
        if (req.getActive() != null) t.setActive(req.getActive());
        if (req.getCarryForward() != null) t.setCarryForward(req.getCarryForward());
        if (req.getCarryForwardMax() != null) t.setCarryForwardMax(req.getCarryForwardMax());
        if (req.getAccrualType() != null) {
            String v = req.getAccrualType().trim().toUpperCase();
            if (!v.equals("YEARLY") && !v.equals("MONTHLY") && !v.equals("QUARTERLY")) {
                throw new BusinessException("Invalid accrualType — use YEARLY, MONTHLY, or QUARTERLY.");
            }
            t.setAccrualType(v);
        }
        if (req.getMinAdvanceDays() != null) t.setMinAdvanceDays(Math.max(0, req.getMinAdvanceDays()));
        if (req.getMaxConsecutiveDays() != null) t.setMaxConsecutiveDays(Math.max(0, req.getMaxConsecutiveDays()));
        if (req.getRequiresAttachmentAfterDays() != null) {
            t.setRequiresAttachmentAfterDays(Math.max(0, req.getRequiresAttachmentAfterDays()));
        }
        if (req.getApplicableGender() != null) {
            String v = req.getApplicableGender().trim().toUpperCase();
            if (!v.equals("ANY") && !v.equals("MALE") && !v.equals("FEMALE")) {
                throw new BusinessException("Invalid applicableGender — use ANY, MALE, or FEMALE.");
            }
            t.setApplicableGender(v);
        }
        if (req.getMandatoryPerYear() != null) t.setMandatoryPerYear(Math.max(0, req.getMandatoryPerYear()));
    }

    /** Partial update — only non-null fields on the request are
     *  applied. {@code code} is IGNORED (immutable). */
    public LeaveTypeDto update(String id, UpsertLeaveTypeRequest req) {
        LeaveType t = repo.findById(id).orElseThrow(() ->
            new ResourceNotFoundException("LeaveType", id));
        if (req.getName() != null && !req.getName().isBlank()) t.setName(req.getName().trim());
        if (req.getDefaultAnnualQuota() != null) t.setDefaultAnnualQuota(req.getDefaultAnnualQuota());
        if (req.getPaid() != null) t.setPaid(req.getPaid());
        if (req.getSortOrder() != null) t.setSortOrder(req.getSortOrder());
        applyOptional(t, req);
        t.setUpdatedAt(Instant.now());
        return LeaveTypeDto.fromEntity(repo.save(t));
    }

    /** Toggle the active flag — soft-disable rather than delete so
     *  historical applications keep resolving their type name. */
    public LeaveTypeDto toggleActive(String id) {
        LeaveType t = repo.findById(id).orElseThrow(() ->
            new ResourceNotFoundException("LeaveType", id));
        t.setActive(!t.isActive());
        t.setUpdatedAt(Instant.now());
        return LeaveTypeDto.fromEntity(repo.save(t));
    }
}
