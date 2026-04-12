package com.saas.school.common.audit;

import com.saas.school.config.mongodb.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    @Autowired private MongoTemplate mongoTemplate;

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

            AuditLog entry = new AuditLog();
            entry.setTenantId(TenantContext.getTenantId());
            entry.setUserId(userId);
            entry.setUserRole(role);
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setDescription(description);
            entry.setIpAddress(getClientIp());
            entry.setTimestamp(Instant.now());

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

            AuditLog entry = new AuditLog();
            entry.setTenantId(TenantContext.getTenantId());
            entry.setUserId(userId);
            entry.setUserRole(role);
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setDescription(description);
            entry.setOldValue(oldVal);
            entry.setNewValue(newVal);
            entry.setIpAddress(getClientIp());
            entry.setTimestamp(Instant.now());

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
