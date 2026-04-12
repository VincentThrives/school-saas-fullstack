package com.saas.school.config.mongodb;

/**
 * Holds the current tenant ID in a ThreadLocal.
 * Set by JwtAuthFilter on every authenticated request.
 * Cleared in a finally block after the request completes.
 */
public class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new InheritableThreadLocal<>();

    private TenantContext() {}

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }

    public static boolean hasTenant() {
        return CURRENT_TENANT.get() != null;
    }
}
