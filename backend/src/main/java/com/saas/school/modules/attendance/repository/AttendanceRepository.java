package com.saas.school.modules.attendance.repository;
import com.saas.school.modules.attendance.model.Attendance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.time.LocalDate; import java.util.List; import java.util.Optional;
public interface AttendanceRepository extends MongoRepository<Attendance, String> {
    List<Attendance> findByClassIdAndSectionIdAndDate(String c, String s, LocalDate d);
    Optional<Attendance> findByStudentIdAndDate(String studentId, LocalDate date);
    List<Attendance> findByStudentIdAndDateBetween(String studentId, LocalDate from, LocalDate to);
    List<Attendance> findByClassIdAndDateBetween(String classId, LocalDate from, LocalDate to);
    @Query("{'studentId':?0,'date':{$gte:?1,$lte:?2},'status':'ABSENT'}")
    List<Attendance> findAbsentsByStudentAndDateRange(String studentId, LocalDate from, LocalDate to);
    long countByStudentIdAndStatusAndDateBetween(String studentId, Attendance.Status status, LocalDate from, LocalDate to);
    long countByStudentIdAndDateBetween(String studentId, LocalDate from, LocalDate to);
}