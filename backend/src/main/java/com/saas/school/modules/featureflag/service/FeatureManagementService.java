package com.saas.school.modules.featureflag.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.featureflag.dto.CreateTemplateRequest;
import com.saas.school.modules.featureflag.dto.SchoolFeatureResponse;
import com.saas.school.modules.featureflag.model.FeatureAuditLog;
import com.saas.school.modules.featureflag.model.FeatureCatalog;
import com.saas.school.modules.featureflag.model.FeatureTemplate;
import com.saas.school.modules.featureflag.repository.FeatureAuditLogRepository;
import com.saas.school.modules.featureflag.repository.FeatureCatalogRepository;
import com.saas.school.modules.featureflag.repository.FeatureTemplateRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FeatureManagementService {

    private static final Logger log = LoggerFactory.getLogger(FeatureManagementService.class);

    @Autowired private TenantRepository tenantRepository;
    @Autowired private FeatureCatalogRepository featureCatalogRepository;
    @Autowired private FeatureAuditLogRepository featureAuditLogRepository;
    @Autowired private FeatureTemplateRepository featureTemplateRepository;
    @Autowired private AuditService auditService;

    // ── Get School Features ───────────────────────────────────────

    public SchoolFeatureResponse getSchoolFeatures(String tenantId) {
        Tenant tenant = findTenant(tenantId);
        List<FeatureCatalog> catalog = featureCatalogRepository.findAll();
        Map<String, Boolean> flags = tenant.getFeatureFlags();

        List<SchoolFeatureResponse.FeatureDetail> featureDetails = new ArrayList<>();
        for (FeatureCatalog fc : catalog) {
            SchoolFeatureResponse.FeatureDetail detail = new SchoolFeatureResponse.FeatureDetail();
            detail.setFeatureKey(fc.getFeatureKey());
            detail.setDisplayName(fc.getDisplayName());
            detail.setDescription(fc.getDescription());
            detail.setCategory(fc.getCategory());
            detail.setCoreFeature(fc.isCoreFeature());
            detail.setAvailableInPlan(fc.getAvailableInPlans() != null && fc.getAvailableInPlans().contains(tenant.getPlan()));
            detail.setEnabled(flags.getOrDefault(fc.getFeatureKey(), false));
            featureDetails.add(detail);
        }

        int enabledCount = (int) featureDetails.stream().filter(SchoolFeatureResponse.FeatureDetail::isEnabled).count();

        Map<String, List<SchoolFeatureResponse.FeatureDetail>> categories = featureDetails.stream()
                .collect(Collectors.groupingBy(
                        d -> d.getCategory() != null ? d.getCategory() : "other",
                        LinkedHashMap::new,
                        Collectors.toList()));

        SchoolFeatureResponse response = new SchoolFeatureResponse();
        response.setTenantId(tenant.getTenantId());
        response.setSchoolName(tenant.getSchoolName());
        response.setPlan(tenant.getPlan() != null ? tenant.getPlan().name() : null);
        response.setTotalFeatures(featureDetails.size());
        response.setEnabledFeatures(enabledCount);
        response.setFeatures(featureDetails);
        response.setCategories(categories);
        return response;
    }

    // ── Toggle Single Feature ─────────────────────────────────────

    public Map<String, Boolean> toggleFeature(String tenantId, String featureKey, boolean enabled,
                                               String reason, String adminId, String adminName) {
        Tenant tenant = findTenant(tenantId);
        FeatureCatalog catalogEntry = featureCatalogRepository.findById(featureKey)
                .orElseThrow(() -> new ResourceNotFoundException("Feature", featureKey));

        if (catalogEntry.isCoreFeature() && !enabled) {
            throw new BusinessException("Core feature '" + catalogEntry.getDisplayName() + "' cannot be disabled");
        }

        boolean previousState = tenant.getFeatureFlags().getOrDefault(featureKey, false);
        tenant.getFeatureFlags().put(featureKey, enabled);
        tenantRepository.save(tenant);

        logFeatureAudit(tenantId, featureKey, catalogEntry.getDisplayName(), previousState, enabled, adminId, adminName, reason);

        auditService.log(
                enabled ? "ENABLE_FEATURE" : "DISABLE_FEATURE",
                "Tenant", tenantId,
                "Feature '" + featureKey + "' " + (enabled ? "enabled" : "disabled") + " by " + adminName
        );

        log.info("Feature '{}' {} for tenant {} by {}", featureKey, enabled ? "enabled" : "disabled", tenantId, adminName);
        return tenant.getFeatureFlags();
    }

    // ── Bulk Toggle Features ──────────────────────────────────────

    public Map<String, Boolean> bulkToggleFeatures(String tenantId, Map<String, Boolean> features,
                                                    String reason, String adminId, String adminName) {
        Tenant tenant = findTenant(tenantId);
        Map<String, FeatureCatalog> catalogMap = featureCatalogRepository.findAll().stream()
                .collect(Collectors.toMap(FeatureCatalog::getFeatureKey, fc -> fc));

        for (Map.Entry<String, Boolean> entry : features.entrySet()) {
            String featureKey = entry.getKey();
            boolean enabled = entry.getValue();

            FeatureCatalog catalogEntry = catalogMap.get(featureKey);
            if (catalogEntry == null) {
                throw new ResourceNotFoundException("Feature", featureKey);
            }
            if (catalogEntry.isCoreFeature() && !enabled) {
                throw new BusinessException("Core feature '" + catalogEntry.getDisplayName() + "' cannot be disabled");
            }

            boolean previousState = tenant.getFeatureFlags().getOrDefault(featureKey, false);
            tenant.getFeatureFlags().put(featureKey, enabled);

            logFeatureAudit(tenantId, featureKey, catalogEntry.getDisplayName(), previousState, enabled, adminId, adminName, reason);
        }

        tenantRepository.save(tenant);

        auditService.log("BULK_UPDATE_FEATURES", "Tenant", tenantId,
                "Bulk feature update (" + features.size() + " features) by " + adminName);

        log.info("Bulk feature update for tenant {} ({} features) by {}", tenantId, features.size(), adminName);
        return tenant.getFeatureFlags();
    }

    // ── Apply Template ────────────────────────────────────────────

    public Map<String, Boolean> applyTemplate(String tenantId, String templateId, String adminId, String adminName) {
        Tenant tenant = findTenant(tenantId);
        FeatureTemplate template = featureTemplateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("FeatureTemplate", templateId));

        Map<String, FeatureCatalog> catalogMap = featureCatalogRepository.findAll().stream()
                .collect(Collectors.toMap(FeatureCatalog::getFeatureKey, fc -> fc));

        for (Map.Entry<String, Boolean> entry : template.getFeatureFlags().entrySet()) {
            String featureKey = entry.getKey();
            boolean enabled = entry.getValue();
            FeatureCatalog catalogEntry = catalogMap.get(featureKey);

            if (catalogEntry != null) {
                if (catalogEntry.isCoreFeature() && !enabled) {
                    continue; // skip disabling core features silently
                }
                boolean previousState = tenant.getFeatureFlags().getOrDefault(featureKey, false);
                tenant.getFeatureFlags().put(featureKey, enabled);
                logFeatureAudit(tenantId, featureKey, catalogEntry.getDisplayName(), previousState, enabled, adminId, adminName,
                        "Applied template: " + template.getName());
            }
        }

        tenantRepository.save(tenant);

        auditService.log("APPLY_FEATURE_TEMPLATE", "Tenant", tenantId,
                "Template '" + template.getName() + "' applied by " + adminName);

        log.info("Template '{}' applied to tenant {} by {}", template.getName(), tenantId, adminName);
        return tenant.getFeatureFlags();
    }

    // ── Audit Log ─────────────────────────────────────────────────

    public Page<FeatureAuditLog> getAuditLog(String tenantId, Pageable pageable) {
        return featureAuditLogRepository.findByTenantIdOrderByTimestampDesc(tenantId, pageable);
    }

    // ── Undo Toggle ───────────────────────────────────────────────

    public boolean undoToggle(String auditLogId, String adminId, String adminName) {
        FeatureAuditLog auditEntry = featureAuditLogRepository.findById(auditLogId)
                .orElseThrow(() -> new ResourceNotFoundException("FeatureAuditLog", auditLogId));

        if (auditEntry.isUndone()) {
            throw new BusinessException("This toggle has already been undone");
        }

        if (auditEntry.getTimestamp() != null
                && Duration.between(auditEntry.getTimestamp(), Instant.now()).toMinutes() > 5) {
            throw new BusinessException("Cannot undo toggle after 5 minutes");
        }

        Tenant tenant = findTenant(auditEntry.getTenantId());
        tenant.getFeatureFlags().put(auditEntry.getFeatureKey(), auditEntry.isPreviousState());
        tenantRepository.save(tenant);

        auditEntry.setUndone(true);
        auditEntry.setUndoneAt(Instant.now());
        auditEntry.setUndoneBy(adminId);
        featureAuditLogRepository.save(auditEntry);

        logFeatureAudit(auditEntry.getTenantId(), auditEntry.getFeatureKey(), auditEntry.getFeatureDisplayName(),
                auditEntry.isNewState(), auditEntry.isPreviousState(), adminId, adminName,
                "Undo of previous toggle");

        auditService.log("UNDO_FEATURE_TOGGLE", "Tenant", auditEntry.getTenantId(),
                "Feature '" + auditEntry.getFeatureKey() + "' toggle undone by " + adminName);

        log.info("Feature toggle undone: {} for tenant {} by {}", auditEntry.getFeatureKey(), auditEntry.getTenantId(), adminName);
        return true;
    }

    // ── Template CRUD ─────────────────────────────────────────────

    public FeatureTemplate createTemplate(CreateTemplateRequest req, String adminId, String adminName) {
        FeatureTemplate template = new FeatureTemplate();
        template.setName(req.getName());
        template.setDescription(req.getDescription());
        template.setFeatureFlags(req.getFeatureFlags());
        template.setCreatedBy(adminId);
        template.setCreatedByName(adminName);
        template.setUpdatedAt(Instant.now());
        FeatureTemplate saved = featureTemplateRepository.save(template);

        log.info("Feature template '{}' created by {}", req.getName(), adminName);
        return saved;
    }

    public List<FeatureTemplate> getTemplates() {
        return featureTemplateRepository.findAll();
    }

    public void deleteTemplate(String templateId) {
        if (!featureTemplateRepository.existsById(templateId)) {
            throw new ResourceNotFoundException("FeatureTemplate", templateId);
        }
        featureTemplateRepository.deleteById(templateId);
        log.info("Feature template '{}' deleted", templateId);
    }

    // ── Feature Catalog ───────────────────────────────────────────

    public List<FeatureCatalog> getFeatureCatalog() {
        return featureCatalogRepository.findAll();
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Tenant findTenant(String tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
    }

    private void logFeatureAudit(String tenantId, String featureKey, String displayName,
                                  boolean previousState, boolean newState,
                                  String adminId, String adminName, String reason) {
        FeatureAuditLog auditLog = new FeatureAuditLog();
        auditLog.setTenantId(tenantId);
        auditLog.setFeatureKey(featureKey);
        auditLog.setFeatureDisplayName(displayName);
        auditLog.setPreviousState(previousState);
        auditLog.setNewState(newState);
        auditLog.setChangedBy(adminId);
        auditLog.setChangedByName(adminName);
        auditLog.setChangeReason(reason);
        auditLog.setTimestamp(Instant.now());
        auditLog.setUndone(false);
        featureAuditLogRepository.save(auditLog);
    }
}
