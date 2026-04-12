package com.saas.school.modules.classes.repository;
import com.saas.school.modules.classes.model.Subject;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface SubjectRepository extends MongoRepository<Subject, String> {
    List<Subject> findByClassIdAndAcademicYearId(String classId, String academicYearId);
}