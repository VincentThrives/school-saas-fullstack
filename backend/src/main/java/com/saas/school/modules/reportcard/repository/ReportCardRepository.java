package com.saas.school.modules.reportcard.repository;

import com.saas.school.modules.reportcard.model.ReportCard;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ReportCardRepository extends MongoRepository<ReportCard, String> {

    Optional<ReportCard> findByStudentIdAndAcademicYearId(String studentId, String academicYearId);

    List<ReportCard> findByClassIdAndAcademicYearId(String classId, String academicYearId);
}
