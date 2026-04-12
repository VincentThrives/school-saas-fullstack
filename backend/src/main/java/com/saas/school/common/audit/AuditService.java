package com.saas.school.common.audit;

import com.saas.school.config.mongodb.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final MongoTemplate mongoTemplate;

    /**
     * Log an action asynchronously so it never slows down the main request.
     * Always writes to the CENTRAL DB (saas_central.audit_logs) regardless of tenant context.
     */
    @Async
    public void log(String action, String entityType, String entityId, String description) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String userId = auth != null ? (String) auth.getPrincipal() : "system";
            String role   = auth != null && !auth.getAuthorities().isEmpty()
                    ? auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "")
                    : "UNKNOWN";

            AuditLog entry = AuditLog.builder()
                    .tenantId(TenantContext.getTenantId())
                    .userId(userId)
                    .userRole(role)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .description(description)
                    .ipAddress(getClientIp())
                    .timestamp(Instant.now())
                    .build();

            // Always write audit logs to central DB
            mongoTemplate.save(entry, "audit_logs");
        } catch (Exception e) {
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }

    @Async
    public void log(String action, String entityType, String entityId,
                    String description, Object oldVal, Object newVal) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String userId = auth != null ? (String) auth.getPrincipal() : "system";
            String role   = auth != null && !auth.getAuthorities().isEmpty()
                    ? auth.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "")
                    : "UNKNOWN";

            AuditLog entry = AuditLog.builder()
                    .tenantId(TenantContext.getTenantId())
                    .userId(userId)
                    .userRole(role)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .description(description)
                    .oldValue(oldVal)
                    .newValue(newVal)
                    .ipAddress(getClientIp())
                    .timestamp(Instant.now())
                    .build();

            mongoTemplate.save(entry, "audit_logs");
        } catch (Exception e) {
            log.error("Failed to write audit log: {}", e.getMessage());
        }
    }

    private String getClientIp() {
        try {
            var attrs = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest req = attrs.getRequest();
            String xff = req.getHeader("X-Forwarded-For");
            return (xff != null && !xff.isEmpty()) ? xff.split(",")[0].trim() : req.getRemoteAddr();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
