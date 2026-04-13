package com.saas.school.modules.tenant.model;

import com.saas.school.modules.user.model.UserRole;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

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
    private Map<String, Boolean> featureFlags = new HashMap<>();
    private TenantLimits limits;
    private String attendanceMode = "DAY_WISE";

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant suspendedAt;
    private String suspendReason;
    private Instant deletedAt;

    // ── Constructors ──────────────────────────────────────────────

    public Tenant() {
    }

    public Tenant(String tenantId, String schoolName, String subdomain, String customDomain,
                  String databaseName, TenantStatus status, String contactEmail, String contactPhone,
                  Address address, String logoUrl, SubscriptionPlan plan, Map<String, Boolean> featureFlags,
                  TenantLimits limits, Instant createdAt, Instant updatedAt, Instant suspendedAt,
                  String suspendReason, Instant deletedAt) {
        this.tenantId = tenantId;
        this.schoolName = schoolName;
        this.subdomain = subdomain;
        this.customDomain = customDomain;
        this.databaseName = databaseName;
        this.status = status;
        this.contactEmail = contactEmail;
        this.contactPhone = contactPhone;
        this.address = address;
        this.logoUrl = logoUrl;
        this.plan = plan;
        this.featureFlags = featureFlags;
        this.limits = limits;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.suspendedAt = suspendedAt;
        this.suspendReason = suspendReason;
        this.deletedAt = deletedAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getSchoolName() {
        return schoolName;
    }

    public void setSchoolName(String schoolName) {
        this.schoolName = schoolName;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public void setSubdomain(String subdomain) {
        this.subdomain = subdomain;
    }

    public String getCustomDomain() {
        return customDomain;
    }

    public void setCustomDomain(String customDomain) {
        this.customDomain = customDomain;
    }

    public String getDatabaseName() {
        return databaseName;
    }

    public void setDatabaseName(String databaseName) {
        this.databaseName = databaseName;
    }

    public TenantStatus getStatus() {
        return status;
    }

    public void setStatus(TenantStatus status) {
        this.status = status;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }

    public Address getAddress() {
        return address;
    }

    public void setAddress(Address address) {
        this.address = address;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public void setPlan(SubscriptionPlan plan) {
        this.plan = plan;
    }

    public Map<String, Boolean> getFeatureFlags() {
        return featureFlags;
    }

    public void setFeatureFlags(Map<String, Boolean> featureFlags) {
        this.featureFlags = featureFlags;
    }

    public TenantLimits getLimits() {
        return limits;
    }

    public void setLimits(TenantLimits limits) {
        this.limits = limits;
    }

    public String getAttendanceMode() {
        return attendanceMode;
    }

    public void setAttendanceMode(String attendanceMode) {
        this.attendanceMode = attendanceMode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getSuspendedAt() {
        return suspendedAt;
    }

    public void setSuspendedAt(Instant suspendedAt) {
        this.suspendedAt = suspendedAt;
    }

    public String getSuspendReason() {
        return suspendReason;
    }

    public void setSuspendReason(String suspendReason) {
        this.suspendReason = suspendReason;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum TenantStatus { ACTIVE, INACTIVE, SUSPENDED, DELETED }

    public enum SubscriptionPlan { BASIC, STANDARD, ENTERPRISE }

    public static class Address {
        private String street;
        private String city;
        private String state;
        private String country;
        private String zip;

        public Address() {
        }

        public Address(String street, String city, String state, String country, String zip) {
            this.street = street;
            this.city = city;
            this.state = state;
            this.country = country;
            this.zip = zip;
        }

        public String getStreet() {
            return street;
        }

        public void setStreet(String street) {
            this.street = street;
        }

        public String getCity() {
            return city;
        }

        public void setCity(String city) {
            this.city = city;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public String getCountry() {
            return country;
        }

        public void setCountry(String country) {
            this.country = country;
        }

        public String getZip() {
            return zip;
        }

        public void setZip(String zip) {
            this.zip = zip;
        }
    }

    public static class TenantLimits {
        private int maxStudents;
        private int maxUsers;
        private int storageGb;

        public TenantLimits() {
        }

        public TenantLimits(int maxStudents, int maxUsers, int storageGb) {
            this.maxStudents = maxStudents;
            this.maxUsers = maxUsers;
            this.storageGb = storageGb;
        }

        public int getMaxStudents() {
            return maxStudents;
        }

        public void setMaxStudents(int maxStudents) {
            this.maxStudents = maxStudents;
        }

        public int getMaxUsers() {
            return maxUsers;
        }

        public void setMaxUsers(int maxUsers) {
            this.maxUsers = maxUsers;
        }

        public int getStorageGb() {
            return storageGb;
        }

        public void setStorageGb(int storageGb) {
            this.storageGb = storageGb;
        }
    }
}
