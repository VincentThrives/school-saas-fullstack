package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.LeaveApplication;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface LeaveApplicationRepository extends MongoRepository<LeaveApplication, String> {

    /** HR pending queue. */
    List<LeaveApplication> findByStatusOrderByRequestedAtDesc(LeaveApplication.Status status);

    /** HR history (APPROVED + REJECTED + CANCELLED). Sort by review
     *  time then request time so the most recently touched surfaces
     *  first regardless of whether the last touch was an approval or
     *  a cancellation. */
    List<LeaveApplication> findByStatusInOrderByRequestedAtDesc(
        Collection<LeaveApplication.Status> statuses);

    /** Employee's own history (all statuses). */
    List<LeaveApplication> findByEmployeeIdOrderByRequestedAtDesc(String employeeId);

    /** Overlap guard for new applications — returns every non-REJECTED
     *  application whose range intersects [from, to]. The
     *  {@code endDate >= from AND startDate <= to} pattern is the
     *  canonical range-overlap check (Allen's algebra). Filter by
     *  status is applied via {@code $in} on the caller side. */
    List<LeaveApplication> findByEmployeeIdAndStatusInAndEndDateGreaterThanEqualAndStartDateLessThanEqual(
        String employeeId, Collection<LeaveApplication.Status> statuses,
        LocalDate rangeStart, LocalDate rangeEnd);
}
