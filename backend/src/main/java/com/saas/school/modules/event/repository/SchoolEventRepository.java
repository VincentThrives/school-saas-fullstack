package com.saas.school.modules.event.repository;
import com.saas.school.modules.event.model.SchoolEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.LocalDate; import java.util.List;
public interface SchoolEventRepository extends MongoRepository<SchoolEvent, String> {
    @Query("{'startDate':{$gte:?0},'endDate':{$lte:?1}}")
    List<SchoolEvent> findByDateRange(LocalDate from, LocalDate to);

    /** Holidays that overlap the given range (start on or before `to`
     *  AND end on or after `from`). Multi-day holidays that partially
     *  intersect the range are included. Matches events flagged EITHER
     *  by {@code isHoliday=true} OR {@code type=HOLIDAY} — the events
     *  UI sometimes only sets the type enum without the boolean flag,
     *  and we don't want a "marked as holiday" event to be silently
     *  ignored by the HR Attendance Report. */
    @Query("{'$or': [{'isHoliday': true}, {'type': 'HOLIDAY'}], 'startDate':{$lte:?1}, 'endDate':{$gte:?0}}")
    List<SchoolEvent> findOverlappingHolidays(LocalDate from, LocalDate to);

    List<SchoolEvent> findByIsHolidayTrue();
    List<SchoolEvent> findByType(SchoolEvent.EventType type);

    // Filters by derived academicYearId / month / year.
    List<SchoolEvent> findByAcademicYearId(String academicYearId);
    List<SchoolEvent> findByAcademicYearIdAndMonth(String academicYearId, Integer month);
    List<SchoolEvent> findByAcademicYearIdAndYearAndMonth(String academicYearId, Integer year, Integer month);
    List<SchoolEvent> findByYearAndMonth(Integer year, Integer month);

    List<SchoolEvent> findByIsHolidayTrueAndAcademicYearId(String academicYearId);
    List<SchoolEvent> findByIsHolidayTrueAndAcademicYearIdAndMonth(String academicYearId, Integer month);
    List<SchoolEvent> findByIsHolidayTrueAndYearAndMonth(Integer year, Integer month);
}
