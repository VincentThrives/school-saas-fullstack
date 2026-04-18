package com.saas.school.modules.notification.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Idempotency record — one row per (ruleKey, entityId, dateKey). Prevents
 * a rule from firing twice for the same domain event on the same day even
 * if the server restarts mid-run.
 */
@Document(collection = "notification_fire_log")
@CompoundIndexes({
    @CompoundIndex(name = "ruleKey_entityId_dateKey",
        def = "{'ruleKey': 1, 'entityId': 1, 'dateKey': 1}",
        unique = true)
})
public class NotificationFireLog {

    @Id
    private String id;
    private String ruleKey;
    private String entityId;
    private String dateKey; // ISO date, e.g. "2026-04-18"

    @CreatedDate
    private Instant firedAt;

    public NotificationFireLog() {}

    public NotificationFireLog(String ruleKey, String entityId, String dateKey) {
        this.ruleKey = ruleKey;
        this.entityId = entityId;
        this.dateKey = dateKey;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRuleKey() { return ruleKey; }
    public void setRuleKey(String ruleKey) { this.ruleKey = ruleKey; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getDateKey() { return dateKey; }
    public void setDateKey(String dateKey) { this.dateKey = dateKey; }
    public Instant getFiredAt() { return firedAt; }
    public void setFiredAt(Instant firedAt) { this.firedAt = firedAt; }
}
