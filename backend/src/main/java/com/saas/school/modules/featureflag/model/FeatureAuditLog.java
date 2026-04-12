package com.saas.school.modules.featureflag.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "feature_audit_logs")
public class FeatureAuditLog {

    @Id
    private String id;
    private String tenantId;
    private String featureKey;
    private String featureDisplayName;
    private boolean previousState;
    private boolean newState;
    private String changedBy;
    private String changedByName;
    private String changeReason;

    @CreatedDate
    private Instant timestamp;

    private boolean undone;
    private Instant undoneAt;
    private String undoneBy;

    public FeatureAuditLog() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getFeatureKey() { return featureKey; }
    public void setFeatureKey(String featureKey) { this.featureKey = featureKey; }

    public String getFeatureDisplayName() { return featureDisplayName; }
    public void setFeatureDisplayName(String featureDisplayName) { this.featureDisplayName = featureDisplayName; }

    public boolean isPreviousState() { return previousState; }
    public void setPreviousState(boolean previousState) { this.previousState = previousState; }

    public boolean isNewState() { return newState; }
    public void setNewState(boolean newState) { this.newState = newState; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public String getChangedByName() { return changedByName; }
    public void setChangedByName(String changedByName) { this.changedByName = changedByName; }

    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public boolean isUndone() { return undone; }
    public void setUndone(boolean undone) { this.undone = undone; }

    public Instant getUndoneAt() { return undoneAt; }
    public void setUndoneAt(Instant undoneAt) { this.undoneAt = undoneAt; }

    public String getUndoneBy() { return undoneBy; }
    public void setUndoneBy(String undoneBy) { this.undoneBy = undoneBy; }
}
