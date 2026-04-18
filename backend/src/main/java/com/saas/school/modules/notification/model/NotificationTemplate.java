package com.saas.school.modules.notification.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Reusable notification draft. Admins can apply a template in the Compose
 * screen to pre-fill title + body + category + default channels.
 */
@Document(collection = "notification_templates")
public class NotificationTemplate {

    @Id
    private String templateId;

    private String name;               // admin-visible name, e.g. "Fee Due Reminder"
    private String title;              // default notification title
    private String body;                // default notification body
    private String type;                // ANNOUNCEMENT, EXAM, ATTENDANCE, FEE, GENERAL, ALERT
    private String defaultChannel;      // IN_APP, EMAIL, BOTH
    private String createdBy;           // userId

    @CreatedDate  private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    public NotificationTemplate() {}

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDefaultChannel() { return defaultChannel; }
    public void setDefaultChannel(String defaultChannel) { this.defaultChannel = defaultChannel; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
