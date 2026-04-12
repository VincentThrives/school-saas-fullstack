package com.saas.school.config.mongodb;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Dynamically routes MongoDB operations to the correct tenant database.
 *
 * Central DB  → saas_central          (used for tenant registry, super admin)
 * Tenant DB   → school_tenant_<tenantId>  (used for all school data)
 *
 * Extends SimpleMongoClientDatabaseFactory so all MongoDatabaseFactory methods
 * (getSession, getExceptionTranslator, etc.) are inherited automatically.
 * Only getMongoDatabase() is overridden for tenant routing.
 */
@Configuration
public class TenantMongoDbFactory extends SimpleMongoClientDatabaseFactory {

    private static final Logger log = LoggerFactory.getLogger(TenantMongoDbFactory.class);

    private final MongoClient tenantMongoClient;
    private final String centralDbName;
    private final ConcurrentHashMap<String, MongoDatabaseFactory> tenantFactories = new ConcurrentHashMap<>();

    public TenantMongoDbFactory(
            @Value("${spring.data.mongodb.uri:mongodb://localhost:27017}") String mongoUri,
            @Value("${spring.data.mongodb.database:saas_central}") String centralDbName) {
        super(createMongoClient(mongoUri), centralDbName);
        this.tenantMongoClient = createMongoClient(mongoUri);
        this.centralDbName = centralDbName;
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
     * Returns (and caches) a factory for the given tenant.
     * Database name pattern: school_tenant_<tenantId>
     */
    private MongoDatabaseFactory getTenantFactory(String tenantId) {
        return tenantFactories.computeIfAbsent(tenantId, id -> {
            String dbName = buildTenantDbName(id);
            log.debug("Creating MongoDbFactory for tenant: {} → db: {}", id, dbName);
            return new SimpleMongoClientDatabaseFactory(tenantMongoClient, dbName);
        });
    }

    public static String buildTenantDbName(String tenantId) {
        return "school_tenant_" + tenantId.replaceAll("[^a-zA-Z0-9_]", "_");
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
