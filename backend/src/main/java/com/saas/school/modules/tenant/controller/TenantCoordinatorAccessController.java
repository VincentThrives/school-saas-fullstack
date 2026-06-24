package com.saas.school.modules.tenant.controller;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.tenant.model.CoordinatorModule;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tenant-scoped Coordinator Access management — lets the school admin
 * decide which sidenav modules the {@code SCHOOL_COORDINATOR} role can
 * see in their school. Other roles are unaffected by this configuration.
 *
 * <p>Reads + writes go against the central {@code tenants} collection,
 * since that's where tenant-level toggles like {@code featureFlags} and
 * {@code attendanceMode} already live.</p>
 */
@Tag(name = "Tenant - Coordinator Access")
@RestController
@RequestMapping("/api/v1/tenant/coordinator-access")
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
public class TenantCoordinatorAccessController {

    @Autowired private TenantRepository tenantRepository;

    /**
     * Returns the coordinator-access configuration for the current tenant
     * plus the full module catalog so the frontend can render the
     * checklist without a second call. {@code enabled = null} on the
     * Tenant doc surfaces here as the full catalog so freshly-created
     * tenants render with every box ticked.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> get() {
        Tenant tenant = currentTenant();
        List<String> enabled = tenant.getCoordinatorEnabledModules();
        // Null → full access (safe default for tenants that haven't
        // customised the page yet). Empty list means "locked down,
        // coordinator sees only the Dashboard" and we return [] as-is.
        if (enabled == null) {
            enabled = CoordinatorModule.allKeys();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabledModules", enabled);
        body.put("catalog", CoordinatorModule.allKeys());
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    /**
     * Replace the tenant's enabled-modules list. Empty list means
     * "locked down"; sending the full catalog or null restores full
     * access. Unknown keys are silently dropped so future module
     * additions don't break old client builds.
     */
    @PutMapping
    public ResponseEntity<ApiResponse<List<String>>> update(@RequestBody Map<String, Object> body) {
        Tenant tenant = currentTenant();
        List<String> incoming = extractEnabledModules(body);
        tenant.setCoordinatorEnabledModules(incoming);
        Tenant saved = saveOnCentralDb(tenant);
        return ResponseEntity.ok(ApiResponse.success(
                saved.getCoordinatorEnabledModules(),
                "Coordinator access updated"));
    }

    // ── Helpers ────────────────────────────────────────────────────

    /** Load the current tenant from the central registry. TenantContext
     *  must be cleared before the read because the tenants collection
     *  lives in the central DB, not any per-tenant DB. */
    private Tenant currentTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) throw new ResourceNotFoundException("No tenant in context");
        TenantContext.clear();
        try {
            return tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));
        } finally {
            TenantContext.setTenantId(tenantId);
        }
    }

    /** Save the tenant back to the central DB. Same context dance as
     *  the read — without clearing TenantContext the save would route to
     *  the per-tenant DB and silently fail to update the central doc. */
    private Tenant saveOnCentralDb(Tenant tenant) {
        String tenantId = TenantContext.getTenantId();
        TenantContext.clear();
        try {
            return tenantRepository.save(tenant);
        } finally {
            TenantContext.setTenantId(tenantId);
        }
    }

    /** Pull the {@code enabledModules} array out of the request body,
     *  filter to known catalog keys, and return a clean canonical list.
     *  Null / missing → empty list (lock down). */
    @SuppressWarnings("unchecked")
    private List<String> extractEnabledModules(Map<String, Object> body) {
        Object raw = body == null ? null : body.get("enabledModules");
        if (!(raw instanceof List<?> list)) return new ArrayList<>();
        List<String> known = CoordinatorModule.allKeys();
        List<String> out = new ArrayList<>(list.size());
        for (Object o : list) {
            if (o == null) continue;
            String key = o.toString().trim().toUpperCase();
            if (known.contains(key) && !out.contains(key)) out.add(key);
        }
        return out;
    }
}
