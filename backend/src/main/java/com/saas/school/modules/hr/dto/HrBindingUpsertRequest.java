package com.saas.school.modules.hr.dto;

/**
 * Payload for both POST (create) and PUT (update the terminal user id
 * on an existing binding). employeeId is required on create; on update
 * the caller identifies the target row via a URL path parameter, so
 * only the new terminalUserId is needed in the body.
 */
public class HrBindingUpsertRequest {

    private String terminalUserId;
    private String employeeId;

    public HrBindingUpsertRequest() {}

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
}
