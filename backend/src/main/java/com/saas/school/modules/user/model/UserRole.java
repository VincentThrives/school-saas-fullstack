package com.saas.school.modules.user.model;

public enum UserRole {
    SUPER_ADMIN,
    SCHOOL_ADMIN,
    PRINCIPAL,
    TEACHER,
    STUDENT,
    PARENT,
    /**
     * Delegated school staff (office coordinator, attendance keeper,
     * SMS sender). Same default UI surface as SCHOOL_ADMIN, but the
     * sidenav and endpoint access are gated per-tenant by
     * {@link com.saas.school.modules.tenant.model.Tenant#getStaffEnabledModules()}.
     * School admin manages the gates from the Staff Access page —
     * defaults to full access until the admin restricts.
     */
    SCHOOL_STAFF
}
