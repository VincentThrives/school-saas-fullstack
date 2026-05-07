package com.saas.school.modules.push.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One row per (user, device) pair. The token is what FCM uses to deliver
 * to a specific phone — it changes when the app is reinstalled or when
 * Google rotates it, so we treat it as the natural key.
 *
 * One user can have several tokens (their phone, a tablet, etc.) so we
 * can't unique-index just by userId. The token itself IS unique across
 * all FCM users globally, so we index it directly.
 *
 * Multi-tenant routing is via TenantMongoDbFactory — these documents
 * live in the per-tenant database.
 */
@Document(collection = "device_tokens")
@CompoundIndex(name = "user_idx", def = "{'userId': 1}")
public class DeviceToken {

    @Id
    private String id;

    /** The User._id this token is registered under. */
    private String userId;

    /** The FCM token. Treated as the unique identifier for the device. */
    @Indexed(unique = true)
    private String token;

    /** "ANDROID" today; "IOS" once we ship iOS. */
    private String platform;

    private Instant createdAt;
    private Instant lastSeenAt;

    public DeviceToken() {}

    public DeviceToken(String userId, String token, String platform) {
        this.userId = userId;
        this.token = token;
        this.platform = platform;
        this.createdAt = Instant.now();
        this.lastSeenAt = this.createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }
}
