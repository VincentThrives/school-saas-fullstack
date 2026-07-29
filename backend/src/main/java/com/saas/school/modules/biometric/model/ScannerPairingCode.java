package com.saas.school.modules.biometric.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Short-lived pairing code. Admin generates one, tablet redeems it,
 * server bumps {@code usedAt}. TTL-indexed on {@code expiresAt} so
 * Mongo evicts stale codes automatically.
 */
@Document(collection = "scanner_pairing_codes")
public class ScannerPairingCode {

    @Id
    private String id;

    /** SHA-256 of the 6-digit code. Plaintext never touches the DB. */
    @Indexed(unique = true)
    private String codeHash;

    private String tenantId;
    private String deviceLabel;
    private String createdByUserId;

    /** Mongo TTL index removes docs automatically after this instant. */
    @Indexed(expireAfterSeconds = 0)
    private Instant expiresAt;

    private Instant usedAt;
    private String usedByDeviceId;

    @CreatedDate
    private Instant createdAt;

    public ScannerPairingCode() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCodeHash() { return codeHash; }
    public void setCodeHash(String codeHash) { this.codeHash = codeHash; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }

    public String getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(String createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }

    public String getUsedByDeviceId() { return usedByDeviceId; }
    public void setUsedByDeviceId(String usedByDeviceId) { this.usedByDeviceId = usedByDeviceId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
