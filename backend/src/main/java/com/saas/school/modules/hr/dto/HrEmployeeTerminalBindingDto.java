package com.saas.school.modules.hr.dto;

import java.time.Instant;

/**
 * One row on the HR bindings page — the terminal user id plus enough
 * employee context (id, display name, designation) to identify who
 * the mapping is for at a glance. Filled by
 * {@code HrTerminalBindingService.listBindings}.
 */
public class HrEmployeeTerminalBindingDto {

    /** Only set once the row is persisted — used for update/delete
     *  targeting from the UI. */
    private String bindingId;
    private String terminalSerial;
    private String terminalUserId;

    private String employeeId;
    private String employeeName;
    /** e.g. "Class Teacher", "Principal", "Accountant" — shown as a
     *  subtitle under the name so HR can distinguish two people with
     *  the same first name. Null for legacy Teacher rows with no
     *  designation set. */
    private String designation;

    private String boundBy;
    private Instant boundAt;

    public HrEmployeeTerminalBindingDto() {}

    public String getBindingId() { return bindingId; }
    public void setBindingId(String bindingId) { this.bindingId = bindingId; }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public String getBoundBy() { return boundBy; }
    public void setBoundBy(String boundBy) { this.boundBy = boundBy; }

    public Instant getBoundAt() { return boundAt; }
    public void setBoundAt(Instant boundAt) { this.boundAt = boundAt; }
}
