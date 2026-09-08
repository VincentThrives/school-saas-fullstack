package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.LeaveType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/** Multi-tenant reads land in the current tenant's DB via the
 *  standard {@code TenantContext} filter — no explicit {@code tenantId}
 *  parameter needed on the finder methods. */
public interface LeaveTypeRepository extends MongoRepository<LeaveType, String> {

    /** Drives the Apply Leave dropdown (active only) and the Leave
     *  Settings page (all, filtered client-side). */
    List<LeaveType> findAllByOrderBySortOrderAscNameAsc();

    List<LeaveType> findByActiveTrueOrderBySortOrderAscNameAsc();

    /** Uniqueness check + lookup on approve / balance provisioning.
     *  {@code code} is case-sensitive stored uppercase — service
     *  normalizes before write. */
    Optional<LeaveType> findByCode(String code);
}
