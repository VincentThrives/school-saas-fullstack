package com.saas.school.modules.timetable.repository;
import com.saas.school.modules.timetable.model.Timetable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List; import java.util.Optional;
public interface TimetableRepository extends MongoRepository<Timetable, String> {
    Optional<Timetable> findByClassIdAndSectionIdAndAcademicYearId(String c, String s, String ay);
    List<Timetable> findByAcademicYearId(String ay);
}