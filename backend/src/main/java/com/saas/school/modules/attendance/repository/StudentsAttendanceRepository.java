package com.saas.school.modules.attendance.repository;

import com.saas.school.modules.attendance.model.StudentsAttendance;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StudentsAttendanceRepository extends MongoRepository<StudentsAttendance, String> {

    // Single day — all periods
    List<StudentsAttendance> findByClassIdAndSectionIdAndDate(String classId, String sectionId, LocalDate date);

    // Single day + specific period (upsert lookup)
    Optional<StudentsAttendance> findByClassIdAndSectionIdAndDateAndPeriodNumber(
            String classId, String sectionId, LocalDate date, int periodNumber);

    // Date range — for reports
    List<StudentsAttendance> findByClassIdAndSectionIdAndDateBetween(
            String classId, String sectionId, LocalDate from, LocalDate to);

    // Student-specific: all records containing a student in date range
    // (handled via service-level filtering since entries is embedded)
}
