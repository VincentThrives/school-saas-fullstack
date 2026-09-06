package com.saas.school.modules.hr.dto;

/**
 * Employee who has no binding on any terminal. Populated by
 * {@code HrTerminalBindingService.getUnboundEmployees}. Used by the
 * "add binding" dropdown so HR only sees employees who aren't already
 * enrolled somewhere — prevents accidentally double-binding the same
 * person on the same terminal.
 */
public class HrUnboundEmployeeDto {

    private String employeeId;
    private String name;
    private String designation;

    public HrUnboundEmployeeDto() {}

    public HrUnboundEmployeeDto(String employeeId, String name, String designation) {
        this.employeeId = employeeId;
        this.name = name;
        this.designation = designation;
    }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }
}
