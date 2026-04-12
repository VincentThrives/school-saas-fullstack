package com.saas.school.modules.academicyear.repository;
import com.saas.school.modules.academicyear.model.AcademicYear;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
public interface AcademicYearRepository extends MongoRepository<AcademicYear, String> {
    Optional<AcademicYear> findByIsCurrent(boolean isCurrent);
    boolean existsByLabel(String label);
}