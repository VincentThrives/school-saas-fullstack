package com.saas.school.modules.notification.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-tenant configuration for an automatic notification trigger.
 * The schedule/engine that actually fires these is a follow-up; for now,
 * admins configure here which rules are on, their channel, and optional
 * template. Rules seed on first GET so the list is never empty.
 */
@Document(collection = "notification_rules")
public class NotificationRule {

    @Id
    private String id;

    private String ruleKey;        // unique per tenant; e.g. ABSENCE_ALERT
    private String name;           // admin-visible label
    private String description;    // explanatory text
    private boolean enabled;
    private String channel;        // IN_APP / EMAIL / BOTH
    private String defaultChannel; // original factory default, for "reset"
    private String templateId;     // optional link to NotificationTemplate
    private Instant lastFiredAt;   // set by future scheduler jobs

    @CreatedDate  private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    public NotificationRule() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRuleKey() { return ruleKey; }
    public void setRuleKey(String ruleKey) { this.ruleKey = ruleKey; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getDefaultChannel() { return defaultChannel; }
    public void setDefaultChannel(String defaultChannel) { this.defaultChannel = defaultChannel; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public Instant getLastFiredAt() { return lastFiredAt; }
    public void setLastFiredAt(Instant lastFiredAt) { this.lastFiredAt = lastFiredAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
