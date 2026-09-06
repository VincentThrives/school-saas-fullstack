package com.saas.school.modules.hr.dto;

import java.time.Instant;

/**
 * Terminal option the HR bindings page loads into its terminal
 * dropdown. Slimmer than the admin {@code TerminalResponse} — HR
 * doesn't need the today-scan-count or last-punch summary, just enough
 * to identify the device.
 */
public class HrTerminalDto {

    private String terminalSerial;
    private String label;
    private Instant lastSeenAt;
    private long employeeBindingCount;

    public HrTerminalDto() {}

    public HrTerminalDto(String terminalSerial, String label,
                         Instant lastSeenAt, long employeeBindingCount) {
        this.terminalSerial = terminalSerial;
        this.label = label;
        this.lastSeenAt = lastSeenAt;
        this.employeeBindingCount = employeeBindingCount;
    }

    public String getTerminalSerial() { return terminalSerial; }
    public void setTerminalSerial(String terminalSerial) { this.terminalSerial = terminalSerial; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Instant getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(Instant lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public long getEmployeeBindingCount() { return employeeBindingCount; }
    public void setEmployeeBindingCount(long employeeBindingCount) {
        this.employeeBindingCount = employeeBindingCount;
    }
}
