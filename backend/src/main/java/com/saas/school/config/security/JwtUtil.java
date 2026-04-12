package com.saas.school.config.security;

import com.saas.school.modules.user.model.UserRole;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;

@Slf4j
@Component
public class JwtUtil {

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

    /** Generate access token for tenant user */
    public String generateAccessToken(String userId, String tenantId, UserRole role,
                                       Map<String, Boolean> featureFlags) {
        long expiry = role == UserRole.SUPER_ADMIN ? superAdminAccessExpiryMs : accessTokenExpiryMs;

        JwtBuilder builder = Jwts.builder()
                .subject(userId)
                .claim("role", role.name())
                .claim("featureFlags", featureFlags)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiry))
                .signWith(getSigningKey());

        // CRITICAL: Super Admin JWT must NOT contain tenantId
        if (tenantId != null && role != UserRole.SUPER_ADMIN) {
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
