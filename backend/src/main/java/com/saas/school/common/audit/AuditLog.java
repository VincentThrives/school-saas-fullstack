package com.saas.school.common.audit;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@Document(collection = "audit_logs")
public class AuditLog {
    @Id
    private String id;
    private String tenantId;          // null for super admin actions
    private String userId;
    private String userRole;
    private String action;            // CREATE_USER, UPDATE_TENANT, DELETE_STUDENT, etc.
    private String entityType;        // User, Student, Tenant, etc.
    private String entityId;
    private String ipAddress;
    private String description;
    private Object oldValue;          // Before state (optional)
    private Object newValue;          // After state (optional)
    private Instant timestamp;
}
