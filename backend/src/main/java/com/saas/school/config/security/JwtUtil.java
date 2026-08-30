package com.saas.school.config.security;

import com.saas.school.modules.user.model.UserRole;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.access-token-expiry-ms}")
    private long accessTokenExpiryMs;

    @Value("${app.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    @Value("${app.jwt.super-admin-access-expiry-ms}")
    private long superAdminAccessExpiryMs;

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(
                java.util.Base64.getEncoder().encodeToString(jwtSecret.getBytes()));
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /** Generate access token for tenant user (single-role convenience — used
     *  by legacy call sites; delegates to the multi-role form below with a
     *  singleton list + activeRole == role). */
    public String generateAccessToken(String userId, String tenantId, UserRole role,
                                       Map<String, Boolean> featureFlags) {
        return generateAccessToken(userId, tenantId, List.of(role), role, featureFlags);
    }

    /**
     * Generate access token carrying the user's full role set + which
     * one they're actively working as. The JWT holds three role-related
     * claims:
     *
     * <ul>
     *   <li>{@code role} — the ACTIVE role. Kept for backward
     *       compatibility with every existing filter / service that
     *       reads a single-string role claim. Equal to {@code activeRole}.</li>
     *   <li>{@code roles} — every role the user is authorised to switch
     *       to. Read by the frontend to render the role-switcher
     *       dropdown; the switch endpoint validates picks against this
     *       set before minting a new token.</li>
     *   <li>{@code activeRole} — explicit copy of the active role so
     *       new code doesn't have to rely on {@code role}'s dual
     *       purpose. Equal to {@code role}.</li>
     * </ul>
     *
     * <p>All three are always populated. Old tokens (without {@code
     * roles} / {@code activeRole}) still work — {@link #getRoles(String)}
     * and {@link #getActiveRole(String)} fall back to {@code role}.</p>
     */
    public String generateAccessToken(String userId, String tenantId,
                                       List<UserRole> roles, UserRole activeRole,
                                       Map<String, Boolean> featureFlags) {
        if (roles == null || roles.isEmpty()) {
            throw new IllegalArgumentException("At least one role is required to issue an access token");
        }
        UserRole resolvedActive = activeRole != null ? activeRole : roles.get(0);
        // Defensive: the active role MUST be one of the roles the user
        // is authorised for. Silently coerce to the first entry if not.
        if (!roles.contains(resolvedActive)) {
            resolvedActive = roles.get(0);
        }
        long expiry = resolvedActive == UserRole.SUPER_ADMIN
                ? superAdminAccessExpiryMs : accessTokenExpiryMs;

        JwtBuilder builder = Jwts.builder()
                .subject(userId)
                .claim("role", resolvedActive.name())               // legacy — mirrors activeRole
                .claim("activeRole", resolvedActive.name())         // explicit new-style claim
                .claim("roles", roles.stream().map(Enum::name).toList())
                .claim("featureFlags", featureFlags)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiry))
                .signWith(getSigningKey());

        // CRITICAL: Super Admin JWT must NOT contain tenantId
        if (tenantId != null && resolvedActive != UserRole.SUPER_ADMIN) {
            builder.claim("tenantId", tenantId);
        }

        return builder.compact();
    }

    /** Generate refresh token (minimal payload) */
    public String generateRefreshToken(String userId, String tenantId, UserRole role) {
        JwtBuilder builder = Jwts.builder()
                .subject(userId)
                .claim("role", role.name())
                .claim("type", "REFRESH")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshTokenExpiryMs))
                .signWith(getSigningKey());

        if (tenantId != null && role != UserRole.SUPER_ADMIN) {
            builder.claim("tenantId", tenantId);
        }

        return builder.compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.debug("JWT expired: {}", e.getMessage());
        } catch (JwtException e) {
            log.debug("JWT invalid: {}", e.getMessage());
        }
        return false;
    }

    public String getUserId(String token) {
        return parseToken(token).getSubject();
    }

    public String getTenantId(String token) {
        return parseToken(token).get("tenantId", String.class);
    }

    public String getRole(String token) {
        return parseToken(token).get("role", String.class);
    }

    /** Returns the ACTIVE role — the hat the user is currently wearing.
     *  Falls back to the legacy {@code role} claim so old tokens
     *  (issued before multi-role support landed) keep authenticating. */
    public String getActiveRole(String token) {
        String active = parseToken(token).get("activeRole", String.class);
        return active != null ? active : parseToken(token).get("role", String.class);
    }

    /** Returns every role the user is authorised to switch to. Falls
     *  back to a singleton list of the legacy {@code role} claim so
     *  old tokens behave like a single-role user (which they were). */
    @SuppressWarnings("unchecked")
    public List<String> getRoles(String token) {
        Object raw = parseToken(token).get("roles");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            return list.stream().map(Object::toString).toList();
        }
        String single = parseToken(token).get("role", String.class);
        return single != null ? List.of(single) : List.of();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Boolean> getFeatureFlags(String token) {
        Object flags = parseToken(token).get("featureFlags");
        return flags instanceof Map<?, ?> ? (Map<String, Boolean>) flags : Map.of();
    }

    public boolean isRefreshToken(String token) {
        return "REFRESH".equals(parseToken(token).get("type", String.class));
    }

    public Date getExpiration(String token) {
        return parseToken(token).getExpiration();
    }
}
