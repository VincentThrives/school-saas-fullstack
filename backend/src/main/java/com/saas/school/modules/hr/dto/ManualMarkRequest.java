package com.saas.school.modules.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;

/**
 * HR-only manual attendance entry. Used for the "employee couldn't
 * mark themselves, please stamp it for them" workflow (medical
 * absence noted verbally, off-site training, etc). Distinct from
 * regularization (which is employee-initiated with approval flow).
 */
public class ManualMarkRequest {

    @NotBlank
    private String employeeId;

    @NotNull
    private LocalDate date;

    /** PRESENT / ABSENT / LATE / HALF_DAY. Free string so future
     *  additions (LEAVE, OFF_SITE) don't need a schema change. */
    @NotBlank
    private String status;

    /** Optional — populate for PRESENT / LATE / HALF_DAY. Null-out
     *  intentionally for ABSENT rows. */
    private Instant inTime;
    private Instant outTime;

    private String remarks;

    public ManualMarkRequest() {}

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String v) { this.employeeId = v; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate v) { this.date = v; }

    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }

    public Instant getInTime() { return inTime; }
    public void setInTime(Instant v) { this.inTime = v; }

    public Instant getOutTime() { return outTime; }
    public void setOutTime(Instant v) { this.outTime = v; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String v) { this.remarks = v; }
}
