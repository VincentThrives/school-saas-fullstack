package com.saas.school.modules.exam.repository;

import com.saas.school.modules.exam.model.StudentAssessments;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentAssessmentsRepository extends MongoRepository<StudentAssessments, String> {
    Optional<StudentAssessments> findByExamId(String examId);
    List<StudentAssessments> findByExamIdIn(List<String> examIds);
    List<StudentAssessments> findByAcademicYearIdAndClassId(String academicYearId, String classId);
}
