package com.saas.school.modules.event.repository;
import com.saas.school.modules.event.model.SchoolEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.LocalDate; import java.util.List;
public interface SchoolEventRepository extends MongoRepository<SchoolEvent, String> {
    @Query("{'startDate':{$gte:?0},'endDate':{$lte:?1}}")
    List<SchoolEvent> findByDateRange(LocalDate from, LocalDate to);
    List<SchoolEvent> findByIsHolidayTrue();
    List<SchoolEvent> findByType(SchoolEvent.EventType type);
}