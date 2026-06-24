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
    SCHOOL_COORDINATOR
}
