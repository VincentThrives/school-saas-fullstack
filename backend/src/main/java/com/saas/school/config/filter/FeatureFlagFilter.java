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
import java.util.List;
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
            Map.entry("/api/v1/whatsapp",     "whatsapp"),
            Map.entry("/api/v1/idcards",      "idcards"),
            Map.entry("/api/v1/syllabus",     "syllabus"),
            Map.entry("/api/v1/assignments",  "assignments"),
            Map.entry("/api/v1/analytics",    "analytics"),
            Map.entry("/api/v1/ptm",          "ptm"),
            // Hardware attendance terminals — separate flag so a school
            // can subscribe to the feature only after they've physically
            // installed a device. Gates /biometric/terminals and
            // /biometric/settings only; the ADMS receiver at
            // /api/v1/adms/** is unauthenticated and bypasses this
            // filter entirely.
            Map.entry("/api/v1/biometric",    "biometric_terminal")
    );

    /**
     * HR sub-modules — currently just one ({@code hr_attendance}),
     * but the two-tier structure is set up so future modules
     * ({@code hr_leave}, {@code hr_payroll}, etc.) plug in the same
     * way: umbrella {@code hr_module} + one sub-module per area.
     *
     * <p>Employee-facing endpoints ({@code /mark-self}, {@code /my},
     * {@code /settings/public}, {@code /regularization/request},
     * {@code /regularization/my}) are intentionally NOT in this
     * table — they're gated by the umbrella only. Otherwise a
     * disabled sub-module would block employees from marking
     * themselves in, which is a bad UX and not what the sub-module
     * toggle is meant to control (it's an admin-side toggle for
     * "do we show HR staff the admin surface for this area").</p>
     */
    private static final List<Map.Entry<String, String>> HR_SUB_FEATURES = List.of(
        // Admin-side endpoints under /attendance:
        Map.entry("/api/v1/hr/attendance/regularization/pending",  "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/regularization/history",  "hr_attendance"),
        // regularization/{id}/approve, /reject — HR admin actions.
        // The /request and /my sub-paths are matched employee-side
        // above by NOT being in this table (falls through to umbrella).
        Map.entry("/api/v1/hr/attendance/regularization/",         "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/bindings",                "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/settings",                "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/employees",               "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/daily",                   "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/monthly",                 "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/report",                  "hr_attendance"),
        Map.entry("/api/v1/hr/attendance/mark-manual",             "hr_attendance"),
        // Leave admin surface — pending queue, history, approve/reject,
        // type CRUD, and cross-employee balance lookups. Employee-facing
        // paths (/apply, /my, /my/balance, /{id}/cancel, /types/active)
        // stay off this list and fall through to the umbrella only, so
        // employees can still apply / view their own leave when the
        // sub-module is off for HR staff (rare but coherent).
        Map.entry("/api/v1/hr/leave/pending",                      "hr_leave"),
        Map.entry("/api/v1/hr/leave/history",                      "hr_leave"),
        Map.entry("/api/v1/hr/leave/types",                        "hr_leave"),
        Map.entry("/api/v1/hr/leave/employees",                    "hr_leave")
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

        boolean isHrPath = uri.startsWith("/api/v1/hr/");
        String requiredFeature = resolveFeature(uri);

        // Nothing to check — non-flagged endpoint AND not HR.
        if (requiredFeature == null && !isHrPath) {
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

        // HR paths: umbrella check first — if the whole module is
        // off, every endpoint under /api/v1/hr/ is blocked with the
        // umbrella key, regardless of any sub-feature toggle.
        if (isHrPath) {
            Boolean hrEnabled = flags.get("hr_module");
            if (Boolean.FALSE.equals(hrEnabled)) {
                log.debug("HR module disabled for this tenant — blocking {}", uri);
                sendFeatureDisabledResponse(response, "hr_module");
                return;
            }
        }

        if (requiredFeature != null) {
            Boolean enabled = flags.get(requiredFeature);
            if (Boolean.FALSE.equals(enabled)) {
                log.debug("Feature '{}' is disabled for this tenant — blocking {}", requiredFeature, uri);
                sendFeatureDisabledResponse(response, requiredFeature);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Two-tier lookup: HR sub-feature table first (most-specific
     * prefixes for /api/v1/hr/*), then the generic per-module table.
     * Returns null if no flag applies — combined with the HR umbrella
     * check upstream, that means "no gating" for genuinely unflagged
     * paths, but HR paths still get umbrella-gated even when this
     * returns null (e.g., /mark-self).
     */
    private String resolveFeature(String uri) {
        for (Map.Entry<String, String> entry : HR_SUB_FEATURES) {
            if (uri.startsWith(entry.getKey())) {
                return entry.getValue();
            }
        }
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
