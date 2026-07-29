package com.saas.school.config.filter;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometric.model.ScannerDevice;
import com.saas.school.modules.biometric.repository.ScannerDeviceRepository;
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
 * {@link JwtAuthFilter} — if there's no Bearer token but there IS an
 * {@code X-Device-Token} header, we resolve it against
 * {@code scanner_devices}, stamp the tenant context, and inject a
 * synthetic {@code ROLE_SCANNER} principal.
 *
 * <p>The tablet cannot become an admin, teacher, or student — the
 * only authority it ever holds is {@code ROLE_SCANNER}, which is
 * required on the two kiosk endpoints ({@code roster}, {@code scan})
 * and nowhere else in the codebase.</p>
 */
@Component
public class ScannerDeviceAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ScannerDeviceAuthFilter.class);
    public static final String HEADER = "X-Device-Token";
    public static final String REQUEST_ATTR_DEVICE_ID = "scannerDeviceId";

    @Autowired private ScannerDeviceRepository deviceRepository;

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

        String header = request.getHeader(HEADER);
        if (!StringUtils.hasText(header)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String hash = sha256(header.trim());
            ScannerDevice device = deviceRepository.findByDeviceTokenHash(hash).orElse(null);
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

            // Stamp tenant context for DB routing (mirrors JwtAuthFilter).
            TenantContext.setTenantId(device.getTenantId());

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
            // JwtAuthFilter's finally already clears the context on the
            // parent chain — but if we set it and JWT filter never ran
            // (device-token requests don't have a Bearer), we must clear
            // it here too. Idempotent-safe.
            TenantContext.clear();
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
