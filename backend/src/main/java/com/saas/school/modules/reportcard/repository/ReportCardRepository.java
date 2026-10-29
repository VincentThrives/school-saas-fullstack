package com.saas.school.modules.reportcard.repository;

import com.saas.school.modules.reportcard.model.ReportCard;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReportCardRepository extends MongoRepository<ReportCard, String> {

    Optional<ReportCard> findByStudentIdAndAcademicYearId(String studentId, String academicYearId);

    List<ReportCard> findByClassIdAndAcademicYearId(String classId, String academicYearId);

    /** Every stored card for (student, year, exam). Historically a UPSERT
     *  was missing, so this can return 20+ duplicate rows per student per
     *  exam; we use the first and clean up the rest. */
    List<ReportCard> findByStudentIdAndAcademicYearIdAndExamType(String studentId, String academicYearId, String examType);
}
