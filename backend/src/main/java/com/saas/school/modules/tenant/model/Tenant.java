package com.saas.school.modules.tenant.model;

import com.saas.school.modules.user.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tenants")
public class Tenant {

    @Id
    private String tenantId;

    private String schoolName;

    @Indexed(unique = true)
    private String subdomain;

    private String customDomain;
    private String databaseName;
    private TenantStatus status;
    private String contactEmail;
    private String contactPhone;
    private Address address;
    private String logoUrl;
    private SubscriptionPlan plan;

    @Builder.Default
    private Map<String, Boolean> featureFlags = new HashMap<>();

    private TenantLimits limits;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant suspendedAt;
    private String suspendReason;
    private Instant deletedAt;   // soft delete

    // ── Nested types ──────────────────────────────────────────────

    public enum TenantStatus { ACTIVE, INACTIVE, SUSPENDED, DELETED }

    public enum SubscriptionPlan { BASIC, STANDARD, ENTERPRISE }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Address {
        private String street;
        private String city;
        private String state;
        private String country;
        private String zip;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TenantLimits {
        private int maxStudents;
        private int maxUsers;
        private int storageGb;
    }
}
