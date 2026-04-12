package com.saas.school.modules.tenant.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantMongoDbFactory;
import com.saas.school.modules.featureflag.model.FeatureCatalog;
import com.saas.school.modules.featureflag.repository.FeatureCatalogRepository;
import com.saas.school.modules.superadmin.dto.*;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.model.Tenant.TenantStatus;
import com.saas.school.modules.tenant.model.Tenant.SubscriptionPlan;
import com.saas.school.modules.tenant.repository.TenantRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    @Autowired private TenantRepository tenantRepository;
    @Autowired private FeatureCatalogRepository featureCatalogRepository;
    @Autowired private TenantMongoDbFactory tenantMongoDbFactory;
    @Autowired private MongoTemplate centralMongoTemplate;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    @Autowired private JavaMailSender mailSender;

    @Value("${app.tenant.default-max-students:500}")
    private int defaultMaxStudents;

    @Value("${app.tenant.default-max-users:30}")
    private int defaultMaxUsers;

    @Value("${app.tenant.default-storage-gb:5}")
    private int defaultStorageGb;

    // ── Tenant CRUD ────────────────────────────────────────────────

    public PageResponse<Tenant> listTenants(int page, int size, TenantStatus status, String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Tenant> result = (status != null)
                ? tenantRepository.findByStatusAndNotDeleted(status, pageable)
                : tenantRepository.findAllActive(pageable);

        return PageResponse.of(result.getContent(), result.getTotalElements(), page, size);
    }

    public Tenant getTenant(String tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
    }

    /**
     * Resolve tenant by subdomain or tenantId — used by the public resolve-tenant endpoint.
     * Returns only safe public fields (no DB name, no internal config).
     */
    public TenantPublicInfo resolveTenant(String schoolId) {
        Tenant tenant = tenantRepository.findBySubdomainOrTenantId(schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("School not found. Please check your School ID."));

        if (tenant.getStatus() == TenantStatus.SUSPENDED) {
            throw new BusinessException("This school account is currently suspended. Contact your administrator.");
        }
        if (tenant.getStatus() == TenantStatus.INACTIVE) {
            throw new BusinessException("This school account is inactive.");
        }

        return new TenantPublicInfo(
                tenant.getTenantId(),
                tenant.getSchoolName(),
                tenant.getLogoUrl(),
                tenant.getStatus().name()
        );
    }

    /**
     * Full tenant provisioning:
     * 1. Validate subdomain uniqueness
     * 2. Create Tenant document in central DB
     * 3. Provision per-tenant MongoDB database
     * 4. Seed default feature flags based on plan
     * 5. Create initial SCHOOL_ADMIN user in tenant DB
     */
    public Tenant createTenant(CreateTenantRequest req) {
        if (tenantRepository.existsBySubdomain(req.getSubdomain())) {
            throw new BusinessException("Subdomain already in use: " + req.getSubdomain());
        }

        String tenantId = UUID.randomUUID().toString();
        String dbName   = TenantMongoDbFactory.buildTenantDbName(tenantId);

        // Build default feature flags from catalog
        Map<String, Boolean> featureFlags = buildDefaultFeatureFlags(req.getPlan());

        Tenant.TenantLimits limits = buildLimitsForPlan(req.getPlan());

        Tenant tenant = new Tenant();
        tenant.setTenantId(tenantId);
        tenant.setSchoolName(req.getSchoolName());
        tenant.setSubdomain(req.getSubdomain().toLowerCase());
        tenant.setContactEmail(req.getContactEmail());
        tenant.setContactPhone(req.getContactPhone());
        tenant.setAddress(mapAddress(req.getAddress()));
        tenant.setLogoUrl(req.getLogoUrl());
        tenant.setPlan(req.getPlan());
        tenant.setFeatureFlags(featureFlags);
        tenant.setLimits(limits);
        tenant.setDatabaseName(dbName);
        tenant.setStatus(TenantStatus.ACTIVE);

        tenantRepository.save(tenant);

        // Provision the tenant DB (pre-warms connection, creates indexes)
        tenantMongoDbFactory.provisionTenant(tenantId);

        // Seed initial SCHOOL_ADMIN in the tenant DB
        seedSchoolAdmin(tenantId, req);

        auditService.log("CREATE_TENANT", "Tenant", tenantId,
                "New tenant provisioned: " + req.getSchoolName());

        log.info("Tenant provisioned: {} → {}", tenantId, dbName);
        return tenant;
    }

    public Tenant updateTenant(String tenantId, UpdateTenantRequest req) {
        Tenant tenant = getTenant(tenantId);
        if (req.getSchoolName() != null) tenant.setSchoolName(req.getSchoolName());
        if (req.getContactEmail() != null) tenant.setContactEmail(req.getContactEmail());
        if (req.getContactPhone() != null) tenant.setContactPhone(req.getContactPhone());
        if (req.getLogoUrl() != null)      tenant.setLogoUrl(req.getLogoUrl());
        if (req.getAddress() != null)      tenant.setAddress(mapAddress(req.getAddress()));

        tenantRepository.save(tenant);
        auditService.log("UPDATE_TENANT", "Tenant", tenantId, "Tenant metadata updated");
        return tenant;
    }

    public void changeTenantStatus(String tenantId, TenantStatus newStatus, String reason) {
        Tenant tenant = getTenant(tenantId);
        TenantStatus oldStatus = tenant.getStatus();
        tenant.setStatus(newStatus);

        if (newStatus == TenantStatus.SUSPENDED) {
            tenant.setSuspendedAt(Instant.now());
            tenant.setSuspendReason(reason);
            notifyTenantAdmin(tenant, "Your school account has been suspended: " + reason);
        }

        tenantRepository.save(tenant);
        auditService.log("CHANGE_TENANT_STATUS", "Tenant", tenantId,
                String.format("Status changed: %s → %s. Reason: %s", oldStatus, newStatus, reason));
    }

    public void softDeleteTenant(String tenantId) {
        Tenant tenant = getTenant(tenantId);
        tenant.setDeletedAt(Instant.now());
        tenant.setStatus(TenantStatus.DELETED);
        tenantRepository.save(tenant);
        tenantMongoDbFactory.evictTenant(tenantId);
        auditService.log("SOFT_DELETE_TENANT", "Tenant", tenantId, "Tenant soft deleted");
    }

    // ── Feature Flags ──────────────────────────────────────────────

    public Map<String, Boolean> getFeatureFlags(String tenantId) {
        return getTenant(tenantId).getFeatureFlags();
    }

    public void enableFeature(String tenantId, String featureKey) {
        setFeature(tenantId, featureKey, true);
    }

    public void disableFeature(String tenantId, String featureKey) {
        setFeature(tenantId, featureKey, false);
    }

    public Map<String, Boolean> bulkUpdateFeatures(String tenantId, Map<String, Boolean> updates) {
        Tenant tenant = getTenant(tenantId);
        tenant.getFeatureFlags().putAll(updates);
        tenantRepository.save(tenant);
        auditService.log("BULK_UPDATE_FEATURES", "Tenant", tenantId, "Feature flags bulk updated");
        return tenant.getFeatureFlags();
    }

    private void setFeature(String tenantId, String featureKey, boolean enabled) {
        Tenant tenant = getTenant(tenantId);
        tenant.getFeatureFlags().put(featureKey, enabled);
        tenantRepository.save(tenant);
        auditService.log(
                enabled ? "ENABLE_FEATURE" : "DISABLE_FEATURE",
                "Tenant", tenantId,
                "Feature '" + featureKey + "' " + (enabled ? "enabled" : "disabled")
        );
    }

    // ── Plan Management ────────────────────────────────────────────

    public Tenant changePlan(String tenantId, SubscriptionPlan newPlan) {
        Tenant tenant = getTenant(tenantId);
        SubscriptionPlan oldPlan = tenant.getPlan();
        tenant.setPlan(newPlan);
        tenant.setLimits(buildLimitsForPlan(newPlan));
        tenantRepository.save(tenant);
        auditService.log("CHANGE_PLAN", "Tenant", tenantId,
                String.format("Plan changed: %s → %s", oldPlan, newPlan));
        return tenant;
    }

    // ── Stats ──────────────────────────────────────────────────────

    public GlobalStatsDto getGlobalStats() {
        GlobalStatsDto stats = new GlobalStatsDto();
        stats.setTotalTenants(tenantRepository.count());
        stats.setActiveTenants(tenantRepository.countByStatus(TenantStatus.ACTIVE));
        stats.setInactiveTenants(tenantRepository.countByStatus(TenantStatus.INACTIVE));
        stats.setSuspendedTenants(tenantRepository.countByStatus(TenantStatus.SUSPENDED));
        return stats;
    }

    // ── Helpers ────────────────────────────────────────────────────

    private Map<String, Boolean> buildDefaultFeatureFlags(SubscriptionPlan plan) {
        Map<String, Boolean> flags = new HashMap<>();
        List<FeatureCatalog> catalog = featureCatalogRepository.findAll();
        for (FeatureCatalog feature : catalog) {
            boolean enabled = feature.isDefaultEnabled()
                    && feature.getAvailableInPlans().contains(plan);
            flags.put(feature.getFeatureKey(), enabled);
        }
        // Fallback defaults if catalog is empty
        if (flags.isEmpty()) {
            flags.put("attendance", true);
            flags.put("timetable", true);
            flags.put("exams", true);
            flags.put("mcq", plan != SubscriptionPlan.BASIC);
            flags.put("fee", true);
            flags.put("notifications", true);
            flags.put("events", true);
            flags.put("messaging", plan != SubscriptionPlan.BASIC);
            flags.put("content", true);
            flags.put("report_cards", true);
            flags.put("bulk_import", plan == SubscriptionPlan.ENTERPRISE);
            flags.put("parent_portal", plan != SubscriptionPlan.BASIC);
            flags.put("analytics", plan == SubscriptionPlan.ENTERPRISE);
        }
        return flags;
    }

    private Tenant.TenantLimits buildLimitsForPlan(SubscriptionPlan plan) {
        return switch (plan) {
            case BASIC -> {
                Tenant.TenantLimits limits = new Tenant.TenantLimits();
                limits.setMaxStudents(500);
                limits.setMaxUsers(30);
                limits.setStorageGb(5);
                yield limits;
            }
            case STANDARD -> {
                Tenant.TenantLimits limits = new Tenant.TenantLimits();
                limits.setMaxStudents(2000);
                limits.setMaxUsers(100);
                limits.setStorageGb(20);
                yield limits;
            }
            case ENTERPRISE -> {
                Tenant.TenantLimits limits = new Tenant.TenantLimits();
                limits.setMaxStudents(10000);
                limits.setMaxUsers(500);
                limits.setStorageGb(100);
                yield limits;
            }
        };
    }

    private Tenant.Address mapAddress(CreateTenantRequest.AddressDto dto) {
        if (dto == null) return null;
        Tenant.Address address = new Tenant.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setCountry(dto.getCountry());
        address.setZip(dto.getZip());
        return address;
    }

    private Tenant.Address mapAddress(UpdateTenantRequest.AddressDto dto) {
        if (dto == null) return null;
        Tenant.Address address = new Tenant.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setCountry(dto.getCountry());
        address.setZip(dto.getZip());
        return address;
    }

    private void seedSchoolAdmin(String tenantId, CreateTenantRequest req) {
        User admin = new User();
        admin.setUserId(UUID.randomUUID().toString());
        admin.setTenantId(tenantId);
        admin.setEmail(req.getAdminEmail());
        admin.setPasswordHash(passwordEncoder.encode(req.getAdminPassword()));
        admin.setFirstName(req.getAdminFirstName());
        admin.setLastName(req.getAdminLastName());
        admin.setRole(UserRole.SCHOOL_ADMIN);
        admin.setActive(true);
        admin.setLocked(false);
        admin.setFailedLoginAttempts(0);
        admin.setCreatedAt(Instant.now());

        // Save to TENANT DB — must temporarily set tenant context
        com.saas.school.config.mongodb.TenantContext.setTenantId(tenantId);
        try {
            centralMongoTemplate.save(admin, "users");
        } finally {
            com.saas.school.config.mongodb.TenantContext.clear();
        }
    }

    private void notifyTenantAdmin(Tenant tenant, String message) {
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setTo(tenant.getContactEmail());
            mail.setSubject("School Account Status Update - " + tenant.getSchoolName());
            mail.setText(message);
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Failed to send notification email to tenant {}: {}", tenant.getTenantId(), e.getMessage());
        }
    }
}
