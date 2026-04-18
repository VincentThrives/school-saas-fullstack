package com.saas.school.modules.exam.repository;
import com.saas.school.modules.exam.model.Exam;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface ExamRepository extends MongoRepository<Exam, String> {
    List<Exam> findByClassIdAndAcademicYearId(String classId, String academicYearId);
    List<Exam> findBySubjectIdAndAcademicYearId(String subjectId, String academicYearId);
    List<Exam> findByAcademicYearIdAndStatus(String academicYearId, Exam.ExamStatus status);
    List<Exam> findByClassId(String classId);
    long countByExamType(String examType);
}