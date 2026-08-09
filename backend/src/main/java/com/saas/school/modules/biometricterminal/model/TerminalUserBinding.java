package com.saas.school.modules.biometricterminal.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Maps a terminal's opaque internal user id ("PIN" in eSSL parlance —
 * an enrolment slot number, sometimes a string, sometimes numeric) to
 * one of our students. Every scan that arrives with a userId not
 * present here is logged as "unbound" and dropped — we never guess.
 */
@Document(collection = "terminal_user_bindings")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_serial_tuid_uk",
        def = "{'tenantId':1,'terminalSerial':1,'terminalUserId':1}", unique = true),
    // Used by the admin bindings list — one query per terminal returns
    // every enrolment on it. Also read by the terminal-list count query.
    @CompoundIndex(name = "tenant_serial",
        def = "{'tenantId':1,'terminalSerial':1}")
})
public class TerminalUserBinding {

    @Id
    private String id;

    private String tenantId;
    private String terminalSerial;
    private String terminalUserId;
    private String studentId;

    /** userId of the admin who created the binding — surfaced on the
     *  bindings list so a school can trace "who enrolled Rakesh on the
     *  gate terminal last week?" */
    private String boundBy;
    private Instant boundAt;

    @CreatedDate
    private Instant createdAt;

    public TerminalUserBinding() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getBoundBy() { return boundBy; }
    public void setBoundBy(String boundBy) { this.boundBy = boundBy; }

    public Instant getBoundAt() { return boundAt; }
    public void setBoundAt(Instant boundAt) { this.boundAt = boundAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
