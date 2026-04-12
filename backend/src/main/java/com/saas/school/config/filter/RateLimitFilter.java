package com.saas.school.config.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.saas.school.common.response.ApiResponse;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    @Autowired private ObjectMapper objectMapper;

    @Value("${app.rate-limit.auth-login:10}")
    private int authLoginLimit;

    @Value("${app.rate-limit.super-auth-login:5}")
    private int superAuthLoginLimit;

    @Value("${app.rate-limit.resolve-tenant:20}")
    private int resolveTenantLimit;

    @Value("${app.rate-limit.default:200}")
    private int defaultLimit;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String ip  = getClientIp(request);
        String uri = request.getRequestURI();
        String key = ip + ":" + resolveBucketKey(uri);

        Bucket bucket = buckets.computeIfAbsent(key, k -> createBucket(uri));

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse<Void> body = new ApiResponse<>(false, "Too many requests. Please try again later.", null, Instant.now().toString());
            objectMapper.writeValue(response.getWriter(), body);
        }
    }

    private Bucket createBucket(String uri) {
        int limit = resolveLimit(uri);
        Bandwidth bandwidth = Bandwidth.builder()
                .capacity(limit)
                .refillIntervally(limit, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(bandwidth).build();
    }

    private String resolveBucketKey(String uri) {
        if (uri.contains("/auth/login"))          return "auth_login";
        if (uri.contains("/super/auth/login"))    return "super_login";
        if (uri.contains("/auth/resolve-tenant")) return "resolve_tenant";
        return "default";
    }

    private int resolveLimit(String uri) {
        if (uri.contains("/super/auth/login"))    return superAuthLoginLimit;
        if (uri.contains("/auth/login"))          return authLoginLimit;
        if (uri.contains("/auth/resolve-tenant")) return resolveTenantLimit;
        return defaultLimit;
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
