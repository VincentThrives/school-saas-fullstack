package com.saas.school.config.filter;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.config.security.JwtUtil;
import com.saas.school.modules.user.model.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Executed on every request:
 * 1. Extracts Bearer token from Authorization header
 * 2. Validates JWT and extracts claims
 * 3. Sets TenantContext (ThreadLocal) for DB routing
 * 4. Sets Spring SecurityContext for RBAC
 * 5. Clears TenantContext in finally block
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String token = extractToken(request);
            if (token != null) {
                processToken(token, request);
            }
            filterChain.doFilter(request, response);
        } finally {
            // CRITICAL: always clear TenantContext to prevent leakage between requests
            TenantContext.clear();
        }
    }

    private void processToken(String token, HttpServletRequest request) {
        try {
            if (!jwtUtil.validateToken(token)) return;

            // Reject refresh tokens on API endpoints
            if (jwtUtil.isRefreshToken(token)) {
                log.debug("Refresh token used on non-refresh endpoint — rejected");
                return;
            }

            Claims claims = jwtUtil.parseToken(token);
            String userId   = claims.getSubject();
            String tenantId = claims.get("tenantId", String.class);
            String roleStr  = claims.get("role", String.class);

            UserRole role = UserRole.valueOf(roleStr);

            // Super Admin JWT must never contain tenantId — safety check
            if (role == UserRole.SUPER_ADMIN && tenantId != null) {
                log.warn("Super Admin token contains tenantId — rejected for security");
                return;
            }

            // Set tenant context for DB routing (null for super admin = central DB)
            if (tenantId != null) {
                TenantContext.setTenantId(tenantId);
            }

            // Set Spring Security context
            var auth = new UsernamePasswordAuthenticationToken(
                    userId,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))
            );
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (ExpiredJwtException e) {
            log.debug("Expired JWT on request: {}", request.getRequestURI());
        } catch (Exception e) {
            log.debug("Could not process JWT: {}", e.getMessage());
        }
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
