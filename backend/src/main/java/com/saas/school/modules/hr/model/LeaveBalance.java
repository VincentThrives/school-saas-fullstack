package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-employee, per-year, per-leave-type running balance. Written
 * whenever a leave is approved (increment {@code used}) or an
 * approved leave is cancelled (decrement {@code used}).
 *
 * <p>Rows are auto-provisioned lazily on read: the first time an
 * employee's balance for a given (year, type) is requested, we
 * upsert a row seeded from
 * {@link LeaveType#getDefaultAnnualQuota()}. Admin can override the
 * allocation per employee for edge cases (mid-year joiners, extra
 * quotas) from the HR → Leave → Balances page.</p>
 *
 * <p>{@code remaining} is derived, not stored:
 * {@code allocated + carryForwardIn - used}.</p>
 */
@Document(collection = "leave_balances")
@CompoundIndexes({
    // Balance lookup by (employee, year, code) — the exact query shape
    // the Apply Leave and My Balance surfaces use. Unique so the
    // provisioning race can safely upsert.
    @CompoundIndex(name = "employee_year_type_unique",
        def = "{'employeeId':1,'year':1,'leaveTypeCode':1}", unique = true),
    // Employee's full balance sheet for a year — driven by the widget
    // on the My Leave page and by the HR balance report.
    @CompoundIndex(name = "employee_year",
        def = "{'employeeId':1,'year':1}")
})
public class LeaveBalance {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    /** Teacher.teacherId — matches the pattern used by
     *  {@link EmployeeAttendance} and {@link RegularizationRequest}. */
    private String employeeId;

    /** Calendar year the balance applies to, e.g. 2026. Keeps the
     *  balance sheet trivially bucketable without needing to know
     *  the school's academic year — reports that need academic-year
     *  totals can sum two rows. */
    private int year;

    /** Uppercase code matching {@link LeaveType#getCode()}. Stored
     *  as a string (not id) so a rename of the type name doesn't
     *  break historical rows. */
    private String leaveTypeCode;

    /** Days granted for this year — normally seeded from
     *  {@code LeaveType.defaultAnnualQuota} but overridable per
     *  employee by HR. */
    private double allocated;

    /** Days carried in from the previous year's unused balance.
     *  Zero by default; only populated if the tenant's leave policy
     *  supports carry-forward (future setting). */
    private double carryForwardIn;

    /** Sum of half-day + full-day approvals so far this year. Half-
     *  day = 0.5, full = 1.0. Refunded on approved-leave cancellation. */
    private double used;

    private Instant updatedAt = Instant.now();

    public LeaveBalance() {}

    public LeaveBalance(String tenantId, String employeeId, int year,
                        String leaveTypeCode, double allocated) {
        this.tenantId = tenantId;
        this.employeeId = employeeId;
        this.year = year;
        this.leaveTypeCode = leaveTypeCode;
        this.allocated = allocated;
    }

    /** Derived — never persisted. Callers may reach for a fresh
     *  value even after mutating {@link #used}. */
    public double getRemaining() {
        return allocated + carryForwardIn - used;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public String getLeaveTypeCode() { return leaveTypeCode; }
    public void setLeaveTypeCode(String leaveTypeCode) { this.leaveTypeCode = leaveTypeCode; }

    public double getAllocated() { return allocated; }
    public void setAllocated(double allocated) { this.allocated = allocated; }

    public double getCarryForwardIn() { return carryForwardIn; }
    public void setCarryForwardIn(double carryForwardIn) { this.carryForwardIn = carryForwardIn; }

    public double getUsed() { return used; }
    public void setUsed(double used) { this.used = used; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
