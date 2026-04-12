package com.saas.school.modules.mentoring.repository;
import com.saas.school.modules.mentoring.model.MentoringNote;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface MentoringNoteRepository extends MongoRepository<MentoringNote, String> {
    List<MentoringNote> findByStudentId(String studentId);
    List<MentoringNote> findByTeacherIdAndIsFlaggedTrue(String teacherId);
}