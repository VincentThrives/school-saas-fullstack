package com.saas.school.modules.attendance.repository;

import com.saas.school.modules.attendance.model.StudentsAttendance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StudentsAttendanceRepository extends MongoRepository<StudentsAttendance, String> {

    // Single day — all periods
    List<StudentsAttendance> findByClassIdAndSectionIdAndDate(String classId, String sectionId, LocalDate date);

    /** Every attendance batch for a given date across the whole tenant.
     *  Used by SmsService.listAbsentToday to walk all of today's marks
     *  and surface absent students for the manual-SMS picker. Returns
     *  every period + section + class, hence the service-level dedupe
     *  by studentId. */
    List<StudentsAttendance> findByDate(LocalDate date);

    // Single day + specific period (upsert lookup)
    Optional<StudentsAttendance> findByClassIdAndSectionIdAndDateAndPeriodNumber(
            String classId, String sectionId, LocalDate date, int periodNumber);

    /**
     * Upsert lookup including componentKey — used for hybrid subjects
     * where Theory and Practical share a date + period slot. Mongo's
     * derived-query null handling: passing null for componentKey
     * matches rows where the field is absent (day-wise records),
     * which is the desired behaviour for legacy day-wise upserts.
     */
    Optional<StudentsAttendance> findByClassIdAndSectionIdAndDateAndPeriodNumberAndComponentKey(
            String classId, String sectionId, LocalDate date, int periodNumber, String componentKey);

    /**
     * Upsert lookup including BOTH componentKey AND subPartKey — used
     * for subjects that split into teaching sub-parts (Physics /
     * Chemistry / Biology under a Science course). The unique compound
     * index now spans both keys, so two attendance rows for the same
     * date + period are valid as long as their (componentKey,
     * subPartKey) tuples differ. Pass null for either field to match
     * rows where it is absent — same Mongo derived-query null semantics
     * as the componentKey-only overload above.
     */
    Optional<StudentsAttendance> findByClassIdAndSectionIdAndDateAndPeriodNumberAndComponentKeyAndSubPartKey(
            String classId, String sectionId, LocalDate date, int periodNumber,
            String componentKey, String subPartKey);

    // Date range — for reports.
    //
    // Inclusive on BOTH ends ($gte / $lte). Auto-derived method names like
    // `findBy...DateGreaterThanEqualAndDateLessThanEqual` produce two
    // separate `date` criteria entries which MongoDB's Document rejects
    // ("can't add a second 'date' expression"). The auto-derived `Between`
    // keyword maps to ($gt, $lt) which is exclusive of the upper bound and
    // silently drops the last day. So we hand-write the query.
    @Query("{ 'classId': ?0, 'sectionId': ?1, 'date': { $gte: ?2, $lte: ?3 } }")
    List<StudentsAttendance> findByClassIdAndSectionIdAndDateGreaterThanEqualAndDateLessThanEqual(
            String classId, String sectionId, LocalDate from, LocalDate to);

    // Student-specific: all records containing a student in date range
    // (handled via service-level filtering since entries is embedded)
}
