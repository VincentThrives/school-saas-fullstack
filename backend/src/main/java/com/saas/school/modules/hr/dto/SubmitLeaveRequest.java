package com.saas.school.modules.hr.dto;

import java.time.LocalDate;

/** Payload for {@code POST /api/v1/hr/leave/apply}. */
public class SubmitLeaveRequest {

    private String leaveTypeCode;
    private LocalDate startDate;
    private LocalDate endDate;
    /** 2nd half of startDate — see {@code LeaveApplication.startHalf} javadoc. */
    private boolean startHalf;
    /** 1st half of endDate. Ignored when start == end. */
    private boolean endHalf;
    /** For single-day half-day requests only: which half is the leave
     *  ("FIRST" = morning off, "SECOND" = afternoon off). Ignored on
     *  multi-day / full-day requests. Persisted on {@link com.saas.school.modules.hr.model.LeaveApplication}
     *  so HR knows when the employee is actually present that day. */
    private String halfDayPart;
    private String reason;

    public String getLeaveTypeCode() { return leaveTypeCode; }
    public void setLeaveTypeCode(String leaveTypeCode) { this.leaveTypeCode = leaveTypeCode; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public boolean isStartHalf() { return startHalf; }
    public void setStartHalf(boolean startHalf) { this.startHalf = startHalf; }

    public boolean isEndHalf() { return endHalf; }
    public void setEndHalf(boolean endHalf) { this.endHalf = endHalf; }

    public String getHalfDayPart() { return halfDayPart; }
    public void setHalfDayPart(String halfDayPart) { this.halfDayPart = halfDayPart; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
