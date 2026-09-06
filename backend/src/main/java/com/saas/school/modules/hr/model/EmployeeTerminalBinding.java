package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Employee-side counterpart to {@code TerminalUserBinding}. Maps a
 * physical eSSL terminal's opaque user id (the "PIN" — enrolment slot
 * number, string or numeric) to one of our Teacher / staff rows.
 *
 * <p>A separate collection from the student bindings for two reasons:
 * (a) HR owns this module end-to-end and shouldn't mutate the
 * student-side collection, and (b) the ADMS controller can route
 * cleanly by asking "is this uid an employee first? if not, a
 * student?" without needing a discriminator column on a shared
 * table.</p>
 *
 * <p>The compound unique index prevents a double-binding on the same
 * physical slot — the enrolment slot in an eSSL terminal is a single
 * finger, so mapping it to two different people would just be a data
 * error. Cross-collection collisions (same uid bound to a student AND
 * an employee) are still possible but the ADMS resolver prefers
 * employee, so nothing breaks silently — the student punch just
 * doesn't fire.</p>
 */
@Document(collection = "employee_terminal_bindings")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_serial_tuid_uk",
        def = "{'tenantId':1,'terminalSerial':1,'terminalUserId':1}", unique = true),
    // Powers the per-terminal bindings list — one query returns every
    // employee enrolled on the device.
    @CompoundIndex(name = "tenant_serial",
        def = "{'tenantId':1,'terminalSerial':1}")
})
public class EmployeeTerminalBinding {

    @Id
    private String id;

    private String tenantId;
    private String terminalSerial;
    private String terminalUserId;

    /** Teacher.teacherId of the mapped employee. Kept as a string
     *  reference (not @DBRef) to mirror the rest of the codebase and
     *  keep queries index-friendly. */
    private String employeeId;

    /** userId of the HR admin who created / last updated the binding.
     *  Surfaced in the bindings list so schools can trace who enrolled
     *  which staff member on which terminal. */
    private String boundBy;
    private Instant boundAt;

    @CreatedDate
    private Instant createdAt;

    public EmployeeTerminalBinding() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getBoundBy() { return boundBy; }
    public void setBoundBy(String boundBy) { this.boundBy = boundBy; }

    public Instant getBoundAt() { return boundAt; }
    public void setBoundAt(Instant boundAt) { this.boundAt = boundAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
