package com.saas.school.modules.hr.dto;

import java.util.List;

/**
 * HR balance sheet payload — one row per employee, with their full
 * year's balance grid attached. Populates the HR → Leave → Balances
 * page. Kept flat rather than paginated because employee counts at
 * schools rarely exceed a couple of hundred.
 */
public class EmployeeLeaveBalanceSheet {

    private String employeeId;
    private String employeeName;
    private String designation;
    private List<LeaveBalanceDto> balances;

    public EmployeeLeaveBalanceSheet() {}

    public EmployeeLeaveBalanceSheet(String employeeId, String employeeName,
                                     String designation, List<LeaveBalanceDto> balances) {
        this.employeeId = employeeId;
        this.employeeName = employeeName;
        this.designation = designation;
        this.balances = balances;
    }

    public String getEmployeeId() { return employeeId; }
    public String getEmployeeName() { return employeeName; }
    public String getDesignation() { return designation; }
    public List<LeaveBalanceDto> getBalances() { return balances; }
}
