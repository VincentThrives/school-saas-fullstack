package com.saas.school.modules.sms.repository;

import com.mongodb.client.MongoClient;
import com.saas.school.modules.sms.model.TenantSmsSettings;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Direct-to-central-DB store for {@link TenantSmsSettings}.
 *
 * <h3>Why this exists</h3>
 *
 * SMS settings are a platform-level concept — the Super Admin (who has
 * no tenant context) writes them; tenant admins (who do have a tenant
 * context) read them.
 *
 * The default {@link com.saas.school.config.mongodb.TenantMongoDbFactory}
 * routes by {@code TenantContext.getTenantId()}:
 *
 * <ul>
 *   <li>Super Admin writes → no context → lands in {@code saas_central}</li>
 *   <li>Springfield admin reads → context = Springfield → queries {@code school_springfield}</li>
 * </ul>
 *
 * Same collection name, different databases — so the read never finds
 * the row the Super Admin just saved.
 *
 * <h3>The fix</h3>
 *
 * This store builds its own {@link MongoTemplate} bound directly to the
 * central database using the shared {@link MongoClient}. Every operation
 * goes through this template, so routing is identical regardless of who
 * is calling. We do not use Spring Data's auto-derived repository for
 * this entity precisely because the auto-derived path goes through
 * {@code TenantMongoDbFactory} and gets the wrong DB for tenant-scoped
 * readers.
 *
 * <p>Note: Per-tenant SMS audit logs ({@code SmsAuditLog}) intentionally
 * stay on the tenant-routed Spring Data repo — those rows naturally
 * belong in the per-tenant DB (high volume, tenant-isolated, GDPR-friendly).
 * Only the small global "is SMS on for this tenant?" config lives centrally.</p>
 */
@Component
public class CentralTenantSmsSettingsStore {

    private static final Logger log = LoggerFactory.getLogger(CentralTenantSmsSettingsStore.class);
    private static final String COLLECTION = "tenant_sms_settings";

    private final MongoClient mongoClient;
    private final String centralDbName;

    private MongoTemplate centralTemplate;

    @Autowired
    public CentralTenantSmsSettingsStore(
            MongoClient mongoClient,
            @Value("${spring.data.mongodb.database:saas_central}") String centralDbName) {
        this.mongoClient = mongoClient;
        this.centralDbName = centralDbName;
    }

    @PostConstruct
    void init() {
        this.centralTemplate = new MongoTemplate(
                new SimpleMongoClientDatabaseFactory(mongoClient, centralDbName));
        // Ensure the unique tenantId index exists — Spring Data normally
        // creates it from @Indexed on first repo use, but we are bypassing
        // the repo, so do it explicitly. Idempotent: safe on every boot.
        try {
            centralTemplate.indexOps(TenantSmsSettings.class)
                    .ensureIndex(new Index().on("tenantId", org.springframework.data.domain.Sort.Direction.ASC).unique());
        } catch (Exception e) {
            // Don't fail boot just because an index already exists in a
            // slightly different form; log and move on.
            log.warn("Could not ensure unique tenantId index on {}: {}", COLLECTION, e.getMessage());
        }
        log.info("CentralTenantSmsSettingsStore wired to db={} collection={}", centralDbName, COLLECTION);
    }

    /** Look up the settings doc for a tenant. Always queries the central DB. */
    public Optional<TenantSmsSettings> findByTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) return Optional.empty();
        TenantSmsSettings doc = centralTemplate.findOne(
                Query.query(Criteria.where("tenantId").is(tenantId)),
                TenantSmsSettings.class);
        return Optional.ofNullable(doc);
    }

    /** List every tenant's settings. Drives the Super Admin table view. */
    public List<TenantSmsSettings> findAll() {
        return centralTemplate.findAll(TenantSmsSettings.class);
    }

    /** Upsert — creates on first toggle, replaces thereafter. */
    public TenantSmsSettings save(TenantSmsSettings settings) {
        return centralTemplate.save(settings);
    }

    /** Remove a tenant's settings document entirely. Returns the number of
     *  documents removed — caller can use it to distinguish "deleted" from
     *  "didn't exist" for snackbar messaging.
     *
     *  We delete by tenantId (not by Mongo _id) so the call works even when
     *  the caller only has the tenantId at hand. The unique index on
     *  tenantId guarantees at most one row, so this is effectively a
     *  point-delete. */
    public long deleteByTenantId(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) return 0;
        var result = centralTemplate.remove(
                Query.query(Criteria.where("tenantId").is(tenantId)),
                TenantSmsSettings.class);
        return result.getDeletedCount();
    }
}
