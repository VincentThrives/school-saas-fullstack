package com.saas.school.modules.user.model;

public enum UserRole {
    SUPER_ADMIN,
    SCHOOL_ADMIN,
    PRINCIPAL,
    TEACHER,
    STUDENT,
    PARENT,
    /**
     * Delegated school coordinator (office staff, attendance keeper,
     * SMS sender). Same default UI surface as SCHOOL_ADMIN, but the
     * sidenav and endpoint access are gated per-tenant by
     * {@link com.saas.school.modules.tenant.model.Tenant#getCoordinatorEnabledModules()}.
     * School admin manages the gates from the Coordinator Access page —
     * defaults to full access until the admin restricts.
     */
    SCHOOL_COORDINATOR,

    /**
     * HR / Payroll operator. Dedicated role for the person(s) who run
     * employee attendance, leaves, and payroll. Distinct from
     * {@link #SCHOOL_ADMIN} so a Principal doesn't automatically see
     * payroll data unless explicitly given this role — matches larger
     * schools where HR is a separate function. Small schools can grant
     * both roles to the Principal via the multi-role assignment on
     * User creation ({@link com.saas.school.modules.user.model.User#getRoles()}).
     */
    HR
}
