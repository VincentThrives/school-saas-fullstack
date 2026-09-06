package com.saas.school.modules.hr.dto;

/**
 * Slim employee option for the HR-only "Add missing employee"
 * dropdown on the manual-mark dialog. Exposed by
 * {@code GET /hr/attendance/employees} so HR doesn't need to hit
 * the admin-gated {@code GET /api/v1/employees} endpoint.
 */
public class HrEmployeeOptionDto {

    private String employeeId;
    private String name;
    private String designation;

    public HrEmployeeOptionDto() {}

    public HrEmployeeOptionDto(String employeeId, String name, String designation) {
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
