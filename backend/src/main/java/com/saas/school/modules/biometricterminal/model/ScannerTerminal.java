package com.saas.school.modules.biometricterminal.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One physical eSSL/ZKTeco terminal registered against a tenant. The
 * device's factory-set serial number is the identity — the terminal
 * quotes it as SN=... on every ADMS request, and we accept scans only
 * when (schoolCode + SN) matches a row in this collection.
 */
@Document(collection = "scanner_terminals")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_serial_uk",
        def = "{'tenantId':1,'terminalSerial':1}", unique = true)
})
public class ScannerTerminal {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String terminalSerial;
    private String label;

    /** Bumped every time the terminal pushes cdata or hits getrequest —
     *  drives the "last seen" chip on the admin list so a school can
     *  spot a dead device without walking to the gate. */
    private Instant lastSeenAt;
    private String lastPingIp;

    @CreatedDate
    private Instant createdAt;

    public ScannerTerminal() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public String getLastPingIp() { return lastPingIp; }
    public void setLastPingIp(String lastPingIp) { this.lastPingIp = lastPingIp; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
