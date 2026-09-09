package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.LeaveBalance;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface LeaveBalanceRepository extends MongoRepository<LeaveBalance, String> {

    /** Single-row lookup keyed on the unique
     *  {@code (employee, academicYearId, leaveTypeCode)} composite. */
    Optional<LeaveBalance> findByEmployeeIdAndAcademicYearIdAndLeaveTypeCode(
        String employeeId, String academicYearId, String leaveTypeCode);

    /** Full academic-year sheet for one employee — powers the My
     *  Leave balance widget and the HR balance drill-in. */
    List<LeaveBalance> findByEmployeeIdAndAcademicYearId(String employeeId, String academicYearId);
}
