package com.saas.school.config.mongodb;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Dynamically routes MongoDB operations to the correct tenant database.
 *
 * Central DB  → saas_central               (tenant registry, super admin)
 * Tenant DB   → school_&lt;subdomain&gt;   (per-school data)
 *
 * The per-tenant database name is computed from the subdomain at tenant
 * creation time and stored on {@link Tenant#getDatabaseName()}. All lookups
 * read that field — the factory never recomputes from the tenantId — so
 * the DB name stays stable even if the subdomain is later renamed in the UI.
 */
@Configuration
public class TenantMongoDbFactory extends SimpleMongoClientDatabaseFactory {

    private static final Logger log = LoggerFactory.getLogger(TenantMongoDbFactory.class);

    private static final int MAX_DB_NAME_LENGTH = 38;

    private final MongoClient tenantMongoClient;
    private final String centralDbName;
    private final ConcurrentHashMap<String, MongoDatabaseFactory> tenantFactories = new ConcurrentHashMap<>();

    /** Lazily injected to avoid a circular bean-init order with Spring Data
     *  Mongo (the repository depends on this factory; the factory now needs
     *  the repository). */
    private final TenantRepository tenantRepository;

    @Autowired
    public TenantMongoDbFactory(
            @Value("${spring.data.mongodb.uri:mongodb://localhost:27017}") String mongoUri,
            @Value("${spring.data.mongodb.database:saas_central}") String centralDbName,
            @Lazy TenantRepository tenantRepository) {
        super(createMongoClient(mongoUri), centralDbName);
        this.tenantMongoClient = createMongoClient(mongoUri);
        this.centralDbName = centralDbName;
        this.tenantRepository = tenantRepository;
        log.info("TenantMongoDbFactory initialized with central DB: {}", centralDbName);
    }

    private static MongoClient createMongoClient(String mongoUri) {
        return MongoClients.create(
                MongoClientSettings.builder()
                        .applyConnectionString(new ConnectionString(mongoUri))
                        .build());
    }

    @Bean
    public MongoClient mongoClient() {
        return this.tenantMongoClient;
    }

    @Override
    public MongoDatabase getMongoDatabase() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            // No tenant context → use central DB (super admin, resolve-tenant, etc.)
            return super.getMongoDatabase();
        }
        return getTenantFactory(tenantId).getMongoDatabase();
    }

    @Override
    public MongoDatabase getMongoDatabase(String dbName) {
        return tenantMongoClient.getDatabase(dbName);
    }

    /**
     * Returns (and caches) a factory for the given tenant. The database name
     * is read from {@link Tenant#getDatabaseName()} (set at provisioning time
     * from the subdomain), so callers get a stable, human-recognisable DB
     * name like {@code school_springfield} regardless of the long internal
     * tenantId.
     */
    private MongoDatabaseFactory getTenantFactory(String tenantId) {
        // Fast-path: cached factory.
        MongoDatabaseFactory cached = tenantFactories.get(tenantId);
        if (cached != null) return cached;

        // Slow path: resolve dbName from the central tenant registry.
        // CRITICAL: clear TenantContext for the duration of the lookup. The
        // call ultimately invokes getMongoDatabase() on this same factory; if
        // the tenantId is still set, it re-enters getTenantFactory() and
        // recurses until StackOverflow. Restore the context after the read so
        // the original caller continues with the right routing.
        String previous = TenantContext.getTenantId();
        String dbName;
        try {
            TenantContext.clear();
            dbName = tenantRepository.findById(tenantId)
                    .map(Tenant::getDatabaseName)
                    .filter(n -> n != null && !n.isBlank())
                    .orElseThrow(() -> new IllegalStateException(
                            "No databaseName recorded for tenant " + tenantId +
                            ". Either the tenant doesn't exist or it was created before " +
                            "the short-name scheme was added."));
        } finally {
            if (previous != null) TenantContext.setTenantId(previous);
        }

        log.debug("Creating MongoDbFactory for tenant: {} → db: {}", tenantId, dbName);
        MongoDatabaseFactory factory =
                new SimpleMongoClientDatabaseFactory(tenantMongoClient, dbName);
        MongoDatabaseFactory existing = tenantFactories.putIfAbsent(tenantId, factory);
        return existing != null ? existing : factory;
    }

    /**
     * Builds a short, identifiable database name for a new tenant.
     *
     * <p>Pattern: {@code school_<sanitized-subdomain>}.</p>
     *
     * <p>Sanitization keeps only {@code [a-z0-9]} (Mongo dbname rules — no
     * dots, slashes or spaces). If the sanitized subdomain ends up empty
     * (e.g. it was all symbols) we fall back to the first 8 hex chars of the
     * tenantId so the result is still unique. The final name is hard-capped
     * at {@value #MAX_DB_NAME_LENGTH} characters to stay inside Atlas's
     * strictest limit.</p>
     */
    public static String buildTenantDbName(String subdomain, String tenantId) {
        String slug = (subdomain == null ? "" : subdomain).toLowerCase()
                                                          .replaceAll("[^a-z0-9]", "");
        if (slug.isEmpty()) {
            String tid = (tenantId == null ? "" : tenantId).replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
            slug = tid.length() >= 8 ? tid.substring(0, 8) : tid;
            if (slug.isEmpty()) slug = "unnamed";
        }
        String name = "school_" + slug;
        return name.length() > MAX_DB_NAME_LENGTH ? name.substring(0, MAX_DB_NAME_LENGTH) : name;
    }

    /** Called when a tenant is provisioned. Pre-warms the connection. */
    public void provisionTenant(String tenantId) {
        getTenantFactory(tenantId);
        log.info("Provisioned database for tenant: {}", tenantId);
    }

    /** Called when a tenant is deleted. Removes the cached factory. */
    public void evictTenant(String tenantId) {
        tenantFactories.remove(tenantId);
        log.info("Evicted database factory for tenant: {}", tenantId);
    }
}
