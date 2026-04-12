package com.saas.school.modules.mcq.repository;
import com.saas.school.modules.mcq.model.McqQuestion;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface McqQuestionRepository extends MongoRepository<McqQuestion, String> {
    List<McqQuestion> findBySubjectIdAndClassId(String subjectId, String classId);
    List<McqQuestion> findByCreatedBy(String createdBy);
}