package com.saas.school.modules.academicyear.repository;
import com.saas.school.modules.academicyear.model.AcademicYear;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.LocalDate;
import java.util.Optional;
public interface AcademicYearRepository extends MongoRepository<AcademicYear, String> {
    Optional<AcademicYear> findByIsCurrent(boolean isCurrent);
    boolean existsByLabel(String label);

    /** Find the academic year that contains the given date (startDate ≤ date ≤ endDate). */
    @Query("{ 'startDate': { $lte: ?0 }, 'endDate': { $gte: ?0 } }")
    Optional<AcademicYear> findContaining(LocalDate date);
}
