package com.saas.school.modules.hr.dto;

import java.time.Instant;

/**
 * One row on the HR bindings page's "Punches on this terminal"
 * panel. Aggregates an employee's IN + OUT for a specific date on a
 * specific terminal — HR picks the date from a dropdown, backend
 * returns one row per employee who punched that day.
 *
 * <p>Fields collapse the {@code EmployeeAttendance} row into just
 * what the panel needs to render, plus the display name + designation
 * looked up from the Teacher record. Missing OUT (single-punch tenant
 * or IN-only day) is expressed by a null {@link #outTime} — the UI
 * shows "—".</p>
 */
public class HrTerminalPunchDto {

    private String employeeId;
    private String employeeName;
    private String designation;
    private String terminalUserId;

    /** {@code PRESENT}, {@code LATE}, {@code HALF_DAY} — same
     *  string vocabulary as {@link com.saas.school.modules.hr.model.EmployeeAttendance#getStatus()}. */
    private String status;
    private boolean late;

    private Instant inTime;
    private Instant outTime;

    public HrTerminalPunchDto() {}

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isLate() { return late; }
    public void setLate(boolean late) { this.late = late; }

    public Instant getInTime() { return inTime; }
    public void setInTime(Instant inTime) { this.inTime = inTime; }

    public Instant getOutTime() { return outTime; }
    public void setOutTime(Instant outTime) { this.outTime = outTime; }
}
