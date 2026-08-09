package com.saas.school.modules.biometricterminal.dto;

import java.time.Instant;

public class TerminalResponse {

    private String serial;
    private String label;
    private Instant lastSeenAt;
    private long bindingCount;
    private Instant createdAt;

    public TerminalResponse() {}

    public TerminalResponse(String serial, String label, Instant lastSeenAt,
                            long bindingCount, Instant createdAt) {
        this.serial = serial;
        this.label = label;
        this.lastSeenAt = lastSeenAt;
        this.bindingCount = bindingCount;
        this.createdAt = createdAt;
    }

    public String getSerial() { return serial; }
    public void setSerial(String serial) { this.serial = serial; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public long getBindingCount() { return bindingCount; }
    public void setBindingCount(long bindingCount) { this.bindingCount = bindingCount; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
