package com.saas.school.modules.mcq.repository;
import com.saas.school.modules.mcq.model.McqResult;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List; import java.util.Optional;
public interface McqResultRepository extends MongoRepository<McqResult, String> {
    Optional<McqResult> findByMcqExamIdAndStudentId(String examId, String studentId);
    List<McqResult> findByMcqExamId(String examId);
    List<McqResult> findByStudentId(String studentId);
}