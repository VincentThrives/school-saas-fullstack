package com.saas.school.modules.mcq.repository;
import com.saas.school.modules.mcq.model.McqExam;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface McqExamRepository extends MongoRepository<McqExam, String> {
    List<McqExam> findByClassIdAndStatus(String classId, McqExam.ExamStatus status);
    List<McqExam> findByCreatedBy(String createdBy);
}