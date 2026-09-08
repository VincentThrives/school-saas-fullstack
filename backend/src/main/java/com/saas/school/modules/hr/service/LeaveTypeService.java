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

    /** Starter set for a new tenant — the three types every Indian
     *  school we've onboarded so far uses. Schools can add / edit
     *  later; they can't be recreated by the seeder once at least
     *  one type exists, so this only fires on genuinely-fresh
     *  tenants. */
    private static final LeaveType[] DEFAULTS = new LeaveType[] {
        // (tenantId set at seed time, code, name, quota, paid, sortOrder)
        new LeaveType(null, "CL",  "Casual leave",   12, true,  100),
        new LeaveType(null, "SL",  "Sick leave",     10, true,  200),
        new LeaveType(null, "EL",  "Earned leave",   15, true,  300),
        new LeaveType(null, "LOP", "Loss of pay",     0, false, 900),
    };

    @Autowired private LeaveTypeRepository repo;

    /** Idempotent — no-op if any type already exists for the current
     *  tenant. Called from {@code DataInitializer} on tenant provision. */
    public void seedDefaultsIfEmpty() {
        if (repo.count() > 0) return;
        String tenantId = TenantContext.getTenantId();
        for (LeaveType tpl : DEFAULTS) {
            LeaveType t = new LeaveType(tenantId, tpl.getCode(), tpl.getName(),
                tpl.getDefaultAnnualQuota(), tpl.isPaid(), tpl.getSortOrder());
            repo.save(t);
        }
        log.info("Seeded {} default leave types for tenant {}", DEFAULTS.length, tenantId);
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
        if (req.getActive() != null) t.setActive(req.getActive());
        LeaveType saved = repo.save(t);
        log.info("Leave type created: code={} name={}", saved.getCode(), saved.getName());
        return LeaveTypeDto.fromEntity(saved);
    }

    /** Partial update — only non-null fields on the request are
     *  applied. {@code code} is IGNORED (immutable). */
    public LeaveTypeDto update(String id, UpsertLeaveTypeRequest req) {
        LeaveType t = repo.findById(id).orElseThrow(() ->
            new ResourceNotFoundException("LeaveType", id));
        if (req.getName() != null && !req.getName().isBlank()) t.setName(req.getName().trim());
        if (req.getDefaultAnnualQuota() != null) t.setDefaultAnnualQuota(req.getDefaultAnnualQuota());
        if (req.getPaid() != null) t.setPaid(req.getPaid());
        if (req.getActive() != null) t.setActive(req.getActive());
        if (req.getSortOrder() != null) t.setSortOrder(req.getSortOrder());
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
