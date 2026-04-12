package com.saas.school.modules.classes.repository;
import com.saas.school.modules.classes.model.SchoolClass;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface SchoolClassRepository extends MongoRepository<SchoolClass, String> {
    List<SchoolClass> findByAcademicYearId(String academicYearId);
}