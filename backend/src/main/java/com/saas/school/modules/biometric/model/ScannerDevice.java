package com.saas.school.modules.biometric.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A tablet paired to a tenant for biometric attendance. The tablet
 * ships every request with an {@code X-Device-Token}; {@code ScannerDeviceAuthFilter}
 * resolves the hash to this row, stamps the tenant context, and injects
 * a synthetic {@code ROLE_SCANNER} principal.
 *
 * <p>Deliberately a separate class from the existing FCM {@code DeviceToken}
 * (push notifications) — same package tree elsewhere, non-overlapping
 * name to avoid confusion.</p>
 */
@Document(collection = "scanner_devices")
public class ScannerDevice {

    @Id
    private String deviceId;

    @Indexed
    private String tenantId;

    /** Admin-picked label e.g. "Main Gate". Displayed in the Kiosk
     *  Devices management page. */
    private String label;

    /** SHA-256 hex of the plaintext token. The plaintext is generated
     *  once at pair time, handed to the tablet, then discarded on the
     *  server. */
    @Indexed(unique = true)
    private String deviceTokenHash;

    private String pairedByUserId;
    private Instant lastSeenAt;

    @CreatedDate
    private Instant pairedAt;

    private Instant revokedAt;
    private String revokedBy;

    public ScannerDevice() {}

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getDeviceTokenHash() { return deviceTokenHash; }
    public void setDeviceTokenHash(String deviceTokenHash) { this.deviceTokenHash = deviceTokenHash; }

    public String getPairedByUserId() { return pairedByUserId; }
    public void setPairedByUserId(String pairedByUserId) { this.pairedByUserId = pairedByUserId; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public Instant getPairedAt() { return pairedAt; }
    public void setPairedAt(Instant pairedAt) { this.pairedAt = pairedAt; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public String getRevokedBy() { return revokedBy; }
    public void setRevokedBy(String revokedBy) { this.revokedBy = revokedBy; }
}
