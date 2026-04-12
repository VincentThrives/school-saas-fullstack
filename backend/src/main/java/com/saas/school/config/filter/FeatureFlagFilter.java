package com.saas.school.config.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.saas.school.common.exception.FeatureDisabledException;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.config.security.JwtUtil;
import com.saas.school.modules.user.model.UserRole;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

/**
 * After JwtAuthFilter: checks if the requested module is enabled for the tenant.
 * Maps URI paths to feature keys and checks the featureFlags claim in the JWT.
 *
 * Super Admin endpoints bypass this check entirely.
 * Public endpoints bypass this check entirely.
 */
@Component
public class FeatureFlagFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FeatureFlagFilter.class);

    @Autowired private JwtUtil jwtUtil;
    @Autowired private ObjectMapper objectMapper;

    // Maps URI path segments to feature keys
    private static final Map<String, String> PATH_TO_FEATURE = Map.ofEntries(
            Map.entry("/api/v1/attendance",    "attendance"),
            Map.entry("/api/v1/timetable",     "timetable"),
            Map.entry("/api/v1/exams",         "exams"),
            Map.entry("/api/v1/mcq",           "mcq"),
            Map.entry("/api/v1/fees",          "fee"),
            Map.entry("/api/v1/notifications", "notifications"),
            Map.entry("/api/v1/events",        "events"),
            Map.entry("/api/v1/messages",      "messaging"),
            Map.entry("/api/v1/content",       "content"),
            Map.entry("/api/v1/report-cards",  "report_cards"),
            Map.entry("/api/v1/reports",       "analytics"),
            Map.entry("/api/v1/bulk-import",   "bulk_import"),
            Map.entry("/api/v1/whatsapp",     "whatsapp")
    );

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();

        // Super admin, auth, and public endpoints skip feature check
        if (uri.contains("/super/") || uri.contains("/auth/") || uri.contains("/swagger") || uri.contains("/api-docs")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Only check authenticated requests
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Determine which feature this URI maps to
        String requiredFeature = resolveFeature(uri);
        if (requiredFeature == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract feature flags from JWT
        String token = extractToken(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        // Super Admin bypasses feature flags
        String role = jwtUtil.getRole(token);
        if (UserRole.SUPER_ADMIN.name().equals(role)) {
            filterChain.doFilter(request, response);
            return;
        }

        Map<String, Boolean> flags = jwtUtil.getFeatureFlags(token);
        Boolean enabled = flags.get(requiredFeature);

        if (Boolean.FALSE.equals(enabled)) {
            log.debug("Feature '{}' is disabled for this tenant — blocking {}", requiredFeature, uri);
            sendFeatureDisabledResponse(response, requiredFeature);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String resolveFeature(String uri) {
        for (Map.Entry<String, String> entry : PATH_TO_FEATURE.entrySet()) {
            if (uri.startsWith(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    private void sendFeatureDisabledResponse(HttpServletResponse response, String featureKey)
            throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiResponse<Void> body = new ApiResponse<>(false, "Feature not enabled for this tenant: " + featureKey, null, Instant.now().toString());
        objectMapper.writeValue(response.getWriter(), body);
    }
}
