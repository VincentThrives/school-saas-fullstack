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
    /** Employment category — used by the HR Balances page to render a
     *  small "Contract" / "Probation" badge next to the employee's
     *  name so HR can see at a glance whose balances came from which
     *  per-category policy on the leave type. */
    private String employmentCategory;
    private List<LeaveBalanceDto> balances;

    public EmployeeLeaveBalanceSheet() {}

    public EmployeeLeaveBalanceSheet(String employeeId, String employeeName,
                                     String designation, String employmentCategory,
                                     List<LeaveBalanceDto> balances) {
        this.employeeId = employeeId;
        this.employeeName = employeeName;
        this.designation = designation;
        this.employmentCategory = employmentCategory;
        this.balances = balances;
    }

    public String getEmployeeId() { return employeeId; }
    public String getEmployeeName() { return employeeName; }
    public String getDesignation() { return designation; }
    public String getEmploymentCategory() { return employmentCategory; }
    public List<LeaveBalanceDto> getBalances() { return balances; }
}
