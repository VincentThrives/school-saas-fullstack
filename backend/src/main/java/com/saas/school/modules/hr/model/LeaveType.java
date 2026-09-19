package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

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

    // ── Premium schema — extended attributes ───────────────

    /** One-line explanation shown as a tooltip / help hint on the
     *  Apply Leave dropdown. Empty is fine — the {@code name} carries
     *  the label. */
    private String description;

    /** Hex color used to badge this type on the calendar, the balance
     *  cards, and the leave-request rows. Falls back to a palette
     *  default on the frontend when null / blank. */
    private String color;

    // ── Carry-forward ──────────────────────────────────

    /** When true, unused balance at year-end rolls over into the next
     *  year's opening balance (subject to {@link #carryForwardMax}).
     *  Defaults false — schools opt in per type (typical: EL carries,
     *  CL / SL don't). */
    private boolean carryForward = false;

    /** Cap on days carried forward. 0 = uncapped (rare — most schools
     *  set a hard limit like 30 or 45). Ignored when
     *  {@link #carryForward} is false. */
    private double carryForwardMax = 0;

    // ── Accrual — how the year's allocation is credited ─

    /** How the {@link #defaultAnnualQuota} is credited to the
     *  employee's balance during the year:
     *  <ul>
     *    <li>{@code YEARLY} — full quota granted on Jan 1 (default).</li>
     *    <li>{@code MONTHLY} — 1/12 of the quota credited on the 1st
     *        of each month. Employees can't take leave they haven't
     *        yet accrued.</li>
     *    <li>{@code QUARTERLY} — 1/4 credited each quarter.</li>
     *  </ul>
     *  Accrual is enforced at submit time — the LeaveService rejects
     *  a request that would consume more than the currently-accrued
     *  balance for MONTHLY / QUARTERLY types.
     */
    private String accrualType = "YEARLY";

    // ── Application rules ──────────────────────────────

    /** Minimum days between today and startDate. e.g., PL might need
     *  7 days notice; CL / SL usually 0. Enforced at submit — a
     *  request violating notice is rejected with a specific message. */
    private int minAdvanceDays = 0;

    /** Maximum consecutive working days per single application.
     *  0 = uncapped. Prevents "6-month sabbatical via CL". Enforced
     *  at submit against the effective (working-day) count. */
    private int maxConsecutiveDays = 0;

    /** Threshold at which a supporting document is required.
     *  e.g., SL over 3 days needs a medical certificate. 0 = never.
     *  Enforcement is deferred to a later phase (file upload UX);
     *  today the field is captured for the type so HR knows the
     *  policy and can enforce out-of-band. */
    private int requiresAttachmentAfterDays = 0;

    /** Restricts who can apply. {@code ANY} (default) means every
     *  employee sees it in the dropdown. {@code MALE} / {@code FEMALE}
     *  restrict to that gender — used for maternity / paternity leave. */
    private String applicableGender = "ANY";

    /** Compulsory days that MUST be taken every year — schools use
     *  this for EL where a minimum consumption is mandated by policy.
     *  Tracked via {@code LeaveBalance.mandatoryUsed} so HR can see
     *  who's short and remind them before year-end. 0 = no
     *  compulsory quota. */
    private double mandatoryPerYear = 0;

    /**
     * Per-employment-category overrides. Null / empty on legacy types
     * → the top-level fields above act as a single implicit "applies
     * to all categories" policy (identical to how the type worked
     * before per-category rules landed).
     *
     * <p>When populated, each entry targets one
     * {@link com.saas.school.modules.teacher.model.Teacher#getEmploymentCategory()}
     * value ({@code FULL_TIME}, {@code CONTRACT}, {@code PROBATION},
     * {@code PART_TIME}). Resolver logic in {@link #resolvePolicyFor}
     * matches an employee's category to the right policy and falls
     * back to the top-level fields when there's no match — so an HR
     * user can define policies for only the categories that differ
     * from the default and leave the rest implicit.</p>
     */
    private List<CategoryPolicy> policies;

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

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public boolean isCarryForward() { return carryForward; }
    public void setCarryForward(boolean carryForward) { this.carryForward = carryForward; }

    public double getCarryForwardMax() { return carryForwardMax; }
    public void setCarryForwardMax(double carryForwardMax) { this.carryForwardMax = carryForwardMax; }

    public String getAccrualType() { return accrualType; }
    public void setAccrualType(String accrualType) { this.accrualType = accrualType; }

    public int getMinAdvanceDays() { return minAdvanceDays; }
    public void setMinAdvanceDays(int minAdvanceDays) { this.minAdvanceDays = minAdvanceDays; }

    public int getMaxConsecutiveDays() { return maxConsecutiveDays; }
    public void setMaxConsecutiveDays(int maxConsecutiveDays) { this.maxConsecutiveDays = maxConsecutiveDays; }

    public int getRequiresAttachmentAfterDays() { return requiresAttachmentAfterDays; }
    public void setRequiresAttachmentAfterDays(int requiresAttachmentAfterDays) {
        this.requiresAttachmentAfterDays = requiresAttachmentAfterDays;
    }

    public String getApplicableGender() { return applicableGender; }
    public void setApplicableGender(String applicableGender) { this.applicableGender = applicableGender; }

    public double getMandatoryPerYear() { return mandatoryPerYear; }
    public void setMandatoryPerYear(double mandatoryPerYear) { this.mandatoryPerYear = mandatoryPerYear; }

    public List<CategoryPolicy> getPolicies() { return policies; }
    public void setPolicies(List<CategoryPolicy> policies) { this.policies = policies; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    /**
     * Resolve the effective policy fields for an employee in a given
     * category. Steps:
     * <ol>
     *   <li>If {@link #policies} is populated, look for a matching
     *       entry by {@code categoryCode}. Match → return it.</li>
     *   <li>No match (or {@code policies} null / empty) → build a
     *       fallback policy from the top-level fields on this type
     *       and return it. This preserves the pre-per-category
     *       behavior: every employee gets the same rules.</li>
     * </ol>
     * Callers can rely on a non-null result — resolution never
     * throws.
     *
     * @param categoryCode employee's employment category (FULL_TIME,
     *   CONTRACT, PROBATION, PART_TIME). Null / blank is treated as
     *   FULL_TIME (matches how legacy employees without a category
     *   field are handled).
     */
    public CategoryPolicy resolvePolicyFor(String categoryCode) {
        String category = (categoryCode == null || categoryCode.isBlank())
            ? "FULL_TIME" : categoryCode.trim().toUpperCase();
        if (policies != null) {
            for (CategoryPolicy p : policies) {
                if (p == null || p.getCategoryCode() == null) continue;
                if (category.equalsIgnoreCase(p.getCategoryCode())) return p;
            }
        }
        return defaultPolicyFromTopLevel();
    }

    /** Build a CategoryPolicy from the type's top-level fields. Used
     *  as the fallback when no per-category override matches. */
    private CategoryPolicy defaultPolicyFromTopLevel() {
        CategoryPolicy p = new CategoryPolicy();
        p.setCategoryCode(null);      // null = "applies to all"
        p.setAnnualQuota(this.defaultAnnualQuota);
        p.setAccrualType(this.accrualType != null ? this.accrualType : "YEARLY");
        p.setCarryForward(this.carryForward);
        p.setCarryForwardMax(this.carryForwardMax);
        p.setMinAdvanceDays(this.minAdvanceDays);
        p.setMaxConsecutiveDays(this.maxConsecutiveDays);
        p.setMandatoryPerYear(this.mandatoryPerYear);
        return p;
    }

    /**
     * Per-employment-category policy override. Mirrors the policy
     * fields on {@link LeaveType} — same units, same semantics — but
     * scoped to one employment category. When an employee's category
     * matches, this policy's values are used instead of the type's
     * top-level defaults.
     *
     * <p>Intentionally NOT covering every top-level field:
     * description, color, sortOrder, paid, active, applicableGender,
     * requiresAttachmentAfterDays are properties of the type itself
     * and don't vary by employee category. Only the fields schools
     * actually vary per category live here.</p>
     */
    public static class CategoryPolicy {
        /** FULL_TIME / CONTRACT / PROBATION / PART_TIME. Null on the
         *  synthetic fallback returned by {@link #defaultPolicyFromTopLevel}. */
        private String categoryCode;
        private double annualQuota;
        /** YEARLY / MONTHLY / QUARTERLY — same values the type-level
         *  accrualType accepts. */
        private String accrualType = "YEARLY";
        private boolean carryForward;
        private double carryForwardMax;
        private int minAdvanceDays;
        private int maxConsecutiveDays;
        private double mandatoryPerYear;

        public CategoryPolicy() {}

        public String getCategoryCode() { return categoryCode; }
        public void setCategoryCode(String categoryCode) { this.categoryCode = categoryCode; }

        public double getAnnualQuota() { return annualQuota; }
        public void setAnnualQuota(double annualQuota) { this.annualQuota = annualQuota; }

        public String getAccrualType() { return accrualType; }
        public void setAccrualType(String accrualType) { this.accrualType = accrualType; }

        public boolean isCarryForward() { return carryForward; }
        public void setCarryForward(boolean carryForward) { this.carryForward = carryForward; }

        public double getCarryForwardMax() { return carryForwardMax; }
        public void setCarryForwardMax(double carryForwardMax) { this.carryForwardMax = carryForwardMax; }

        public int getMinAdvanceDays() { return minAdvanceDays; }
        public void setMinAdvanceDays(int minAdvanceDays) { this.minAdvanceDays = minAdvanceDays; }

        public int getMaxConsecutiveDays() { return maxConsecutiveDays; }
        public void setMaxConsecutiveDays(int maxConsecutiveDays) { this.maxConsecutiveDays = maxConsecutiveDays; }

        public double getMandatoryPerYear() { return mandatoryPerYear; }
        public void setMandatoryPerYear(double mandatoryPerYear) { this.mandatoryPerYear = mandatoryPerYear; }
    }
}
