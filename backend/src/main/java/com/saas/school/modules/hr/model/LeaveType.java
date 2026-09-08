package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-tenant catalog of leave types the school offers — e.g., CL
 * (Casual), SL (Sick), EL (Earned/Privileged), LOP (Loss of Pay),
 * MATERNITY, PATERNITY. Rendered as a dropdown on the employee
 * Apply Leave dialog and as the source of default annual balances
 * on {@link LeaveBalance}.
 *
 * <p>Seeded from {@code DataInitializer} on first tenant boot with
 * a starter set (CL / SL / EL). Schools can add / edit / deactivate
 * types from the HR → Leave → Settings page. Deactivating hides the
 * type from new applications but leaves historical rows keyed on
 * {@code code} untouched — {@code code} is therefore immutable once
 * created (enforced in the service).</p>
 *
 * <p>Tenancy is enforced via the standard multi-tenant filter (each
 * tenant DB gets its own {@code leave_types} collection); the
 * {@code (tenantId, code)} compound uniqueness index protects against
 * a UI bug creating two "CL" rows in the same tenant.</p>
 */
@Document(collection = "leave_types")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_code_unique",
        def = "{'tenantId':1,'code':1}", unique = true),
    @CompoundIndex(name = "tenant_sort",
        def = "{'tenantId':1,'sortOrder':1}")
})
public class LeaveType {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    /** Uppercase short code, e.g. "CL", "SL", "EL". Immutable after
     *  creation — used as a stable key on {@link LeaveBalance} and
     *  {@link LeaveApplication}. Length 2-8 chars enforced by service. */
    private String code;

    /** Human-friendly name shown in the dropdown, e.g. "Casual leave". */
    private String name;

    /** Days granted per employee per year. 0 is valid — represents an
     *  uncapped LOP-style type where employees can apply as much as
     *  needed but each day silently deducts pay. */
    private double defaultAnnualQuota;

    /** Whether this leave is paid. False = LOP-style. Purely
     *  informational today; wired into payroll integration later. */
    private boolean paid = true;

    /** False hides the type from the Apply Leave dropdown for new
     *  applications. Existing balances + historical applications
     *  remain readable so reports stay consistent. */
    private boolean active = true;

    /** Display order on the dropdown + settings page. Lower = higher up. */
    private int sortOrder = 100;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public LeaveType() {}

    public LeaveType(String tenantId, String code, String name,
                     double defaultAnnualQuota, boolean paid, int sortOrder) {
        this.tenantId = tenantId;
        this.code = code;
        this.name = name;
        this.defaultAnnualQuota = defaultAnnualQuota;
        this.paid = paid;
        this.sortOrder = sortOrder;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getDefaultAnnualQuota() { return defaultAnnualQuota; }
    public void setDefaultAnnualQuota(double defaultAnnualQuota) { this.defaultAnnualQuota = defaultAnnualQuota; }

    public boolean isPaid() { return paid; }
    public void setPaid(boolean paid) { this.paid = paid; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
