package com.saas.school.modules.hr.repository;

import com.saas.school.modules.hr.model.EmployeeAttendance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeAttendanceRepository extends MongoRepository<EmployeeAttendance, String> {

    /** Idempotency check on self-mark + biometric rollup — one doc per
     *  employee per date is the invariant enforced by the unique index. */
    Optional<EmployeeAttendance> findByEmployeeIdAndDate(String employeeId, LocalDate date);

    /** HR "Daily view — everyone today". Ordered on the client. */
    List<EmployeeAttendance> findByDate(LocalDate date);

    /** Employee "My Attendance — this month" + HR per-employee monthly
     *  report. Bounds are INCLUSIVE both sides — Spring Data MongoDB's
     *  {@code Between} keyword generates one bound only in some
     *  situations, and stacking two method-name conditions on the same
     *  field is forbidden by the BSON builder ("can't add a second
     *  'date' expression"). {@code @Query} with explicit
     *  {@code $gte / $lte} sidesteps both. */
    @Query("{ 'employeeId': ?0, 'date': { $gte: ?1, $lte: ?2 } }")
    List<EmployeeAttendance> findEmployeeRowsInRange(
        String employeeId, LocalDate from, LocalDate to);

    /** Used by the auto-absent scheduled job to find employees who
     *  DON'T yet have a row for today (subtracted client-side against
     *  the full employee roster). */
    List<EmployeeAttendance> findByDateAndEmployeeIdIn(LocalDate date, List<String> employeeIds);

    /** HR "Report — all employees between two dates". Powers the
     *  Attendance Report page. Bounds are INCLUSIVE both sides — see
     *  the note on {@link #findEmployeeRowsInRange} for the same
     *  reason we can't just use {@code Between}. */
    @Query("{ 'date': { $gte: ?0, $lte: ?1 } }")
    List<EmployeeAttendance> findAllRowsInRange(LocalDate from, LocalDate to);
}
