package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.RegularizationRequest;
import com.saas.school.modules.hr.model.RegularizationRequest.Status;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RegularizationRequestRepository
        extends MongoRepository<RegularizationRequest, String> {

    /** HR Approvals queue — newest pending on top. */
    List<RegularizationRequest> findByStatusOrderByRequestedAtDesc(Status status);

    /** HR history tab — everything not pending. Client filters by
     *  reviewer / date range as needed. */
    List<RegularizationRequest> findByStatusInOrderByReviewedAtDesc(List<Status> statuses);

    /** Employee's "My requests" — newest first. */
    List<RegularizationRequest> findByEmployeeIdOrderByRequestedAtDesc(String employeeId);

    /** Idempotency guard on submit — reject a second request for
     *  the same (employee, date) that's already PENDING or approved. */
    List<RegularizationRequest> findByEmployeeIdAndDateAndStatusIn(
        String employeeId, LocalDate date, List<Status> statuses);

    /** Monthly-cap counter — how many requests this employee has
     *  submitted in the given date window (any status except
     *  REJECTED — approved OR pending both count against the cap so
     *  someone can't game it by having 3 pending). */
    long countByEmployeeIdAndDateBetweenAndStatusIn(
        String employeeId, LocalDate from, LocalDate to, List<Status> statuses);

    /** Load-by-id with a null-safe wrapper for the HR review path. */
    Optional<RegularizationRequest> findById(String id);
}
