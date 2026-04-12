package com.saas.school.modules.exam.repository;
import com.saas.school.modules.exam.model.ExamMark;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List; import java.util.Optional;
public interface ExamMarkRepository extends MongoRepository<ExamMark, String> {
    List<ExamMark> findByExamId(String examId);
    List<ExamMark> findByStudentId(String studentId);
    Optional<ExamMark> findByExamIdAndStudentId(String examId, String studentId);
    List<ExamMark> findByStudentIdAndExamIdIn(String studentId, List<String> examIds);
}