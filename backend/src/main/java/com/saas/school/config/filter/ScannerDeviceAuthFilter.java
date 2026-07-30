package com.saas.school.config.filter;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometric.model.ScannerDevice;
import com.saas.school.modules.biometric.repository.ScannerDeviceRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.List;

/**
 * Alternative authentication path for kiosk tablets. Runs after
 * {@link JwtAuthFilter} — if there's no Bearer token but the request
 * carries both {@code X-School-Code} and {@code X-Device-Token}
 * headers, we resolve the tenant from the master DB, set the tenant
 * context, then look up the device in the tenant's own DB and inject
 * a {@code ROLE_SCANNER} principal.
 *
 * <p>Devices live in the tenant DB — clean per-tenant isolation. The
 * {@code X-School-Code} header is how the tablet tells us which
 * tenant to route to (subdomain or tenantId, resolved in master).</p>
 *
 * <p>The tablet cannot become an admin, teacher, or student — the
 * only authority it ever holds is {@code ROLE_SCANNER}, which is
 * required on the two kiosk endpoints ({@code roster}, {@code scan})
 * and nowhere else in the codebase.</p>
 */
@Component
public class ScannerDeviceAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ScannerDeviceAuthFilter.class);
    public static final String HEADER_DEVICE_TOKEN = "X-Device-Token";
    public static final String HEADER_SCHOOL_CODE  = "X-School-Code";
    public static final String REQUEST_ATTR_DEVICE_ID = "scannerDeviceId";

    @Autowired private ScannerDeviceRepository deviceRepository;
    @Autowired private TenantRepository tenantRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        // If a JWT already ran and set an auth, don't overwrite it.
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String tokenHeader = request.getHeader(HEADER_DEVICE_TOKEN);
        String schoolCode  = request.getHeader(HEADER_SCHOOL_CODE);
        if (!StringUtils.hasText(tokenHeader) || !StringUtils.hasText(schoolCode)) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean contextSet = false;
        try {
            // Resolve tenant in master DB — the tablet's schoolCode is
            // either the tenant's subdomain or its tenantId.
            Tenant tenant = resolveTenant(schoolCode.trim());
            if (tenant == null) {
                log.debug("Scanner request references unknown school: {}", schoolCode);
                filterChain.doFilter(request, response);
                return;
            }

            // Set tenant context BEFORE the device lookup so the query
            // routes to that tenant's DB where scanner_devices lives.
            TenantContext.setTenantId(tenant.getTenantId());
            contextSet = true;

            String tokenHash = sha256(tokenHeader.trim());
            ScannerDevice device = deviceRepository.findByDeviceTokenHash(tokenHash).orElse(null);
            if (device == null) {
                log.debug("Unknown scanner device token on {}", request.getRequestURI());
                filterChain.doFilter(request, response);
                return;
            }
            if (device.getRevokedAt() != null) {
                log.debug("Revoked scanner device attempted a request");
                filterChain.doFilter(request, response);
                return;
            }
            if (!tenant.getTenantId().equals(device.getTenantId())) {
                // Should not happen unless the token was minted for a
                // different tenant — refuse quietly.
                log.warn("Scanner device tenant mismatch: schoolCode={} deviceTenant={}",
                        schoolCode, device.getTenantId());
                filterChain.doFilter(request, response);
                return;
            }

            // Synthetic principal — only ROLE_SCANNER authority.
            var auth = new UsernamePasswordAuthenticationToken(
                    "device:" + device.getDeviceId(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_SCANNER"))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
            request.setAttribute(REQUEST_ATTR_DEVICE_ID, device.getDeviceId());

            filterChain.doFilter(request, response);
        } finally {
            // Only clear if we set it. JwtAuthFilter has its own
            // finally that also clears, so double-clear is safe.
            if (contextSet) TenantContext.clear();
        }
    }

    /** Resolve a tenant from either its subdomain (public identifier
     *  admins type in) or its raw tenantId. Runs in master DB — clear
     *  and restore the tenant context around the lookup. */
    private Tenant resolveTenant(String schoolCode) {
        String saved = TenantContext.getTenantId();
        TenantContext.clear();
        try {
            Tenant t = tenantRepository.findBySubdomain(schoolCode).orElse(null);
            if (t == null) t = tenantRepository.findById(schoolCode).orElse(null);
            return t;
        } finally {
            if (saved != null) TenantContext.setTenantId(saved);
        }
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}
