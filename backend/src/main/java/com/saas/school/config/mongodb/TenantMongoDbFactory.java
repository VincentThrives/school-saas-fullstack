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
import org.springframework.dao.support.PersistenceExceptionTranslator;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoExceptionTranslator;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Dynamically routes MongoDB operations to the correct tenant database.
 *
 * Central DB  → saas_central          (used for tenant registry, super admin)
 * Tenant DB   → school_tenant_<tenantId>  (used for all school data)
 *
 * Database connections are cached per tenant to avoid repeated handshakes.
 */
@Configuration
public class TenantMongoDbFactory implements MongoDatabaseFactory {

    private static final Logger log = LoggerFactory.getLogger(TenantMongoDbFactory.class);

    private final MongoClient mongoClient;
    private final String centralDbName;
    private final ConcurrentHashMap<String, MongoDatabaseFactory> tenantFactories = new ConcurrentHashMap<>();

    public TenantMongoDbFactory(
            @Value("${spring.data.mongodb.uri:mongodb://localhost:27017}") String mongoUri,
            @Value("${spring.data.mongodb.database:saas_central}") String centralDbName) {
        this.mongoClient = MongoClients.create(
                MongoClientSettings.builder()
                        .applyConnectionString(new ConnectionString(mongoUri))
                        .build());
        this.centralDbName = centralDbName;
        log.info("TenantMongoDbFactory initialized with central DB: {}", centralDbName);
    }

    @Bean
    public MongoClient mongoClient() {
        return this.mongoClient;
    }

    @Override
    public MongoDatabase getMongoDatabase() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            // No tenant context → use central DB (super admin, resolve-tenant, etc.)
            return mongoClient.getDatabase(centralDbName);
        }
        return getTenantFactory(tenantId).getMongoDatabase();
    }

    @Override
    public MongoDatabase getMongoDatabase(String dbName) {
        return mongoClient.getDatabase(dbName);
    }

    /**
     * Returns (and caches) a factory for the given tenant.
     * Database name pattern: school_tenant_<tenantId>
     */
    private MongoDatabaseFactory getTenantFactory(String tenantId) {
        return tenantFactories.computeIfAbsent(tenantId, id -> {
            String dbName = buildTenantDbName(id);
            log.debug("Creating MongoDbFactory for tenant: {} → db: {}", id, dbName);
            return new SimpleMongoClientDatabaseFactory(mongoClient, dbName);
        });
    }

    public static String buildTenantDbName(String tenantId) {
        // Sanitize tenantId to be a valid MongoDB database name
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

    @Override
    public PersistenceExceptionTranslator getExceptionTranslator() {
        return new MongoExceptionTranslator();
    }

    @Override
    public boolean isNoSqlSessionSynchronizationActive() {
        return false;
    }
}
