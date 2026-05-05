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

    // Single day + specific period (upsert lookup)
    Optional<StudentsAttendance> findByClassIdAndSectionIdAndDateAndPeriodNumber(
            String classId, String sectionId, LocalDate date, int periodNumber);

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
