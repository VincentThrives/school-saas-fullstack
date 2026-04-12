package com.saas.school.modules.teacher.repository;
import com.saas.school.modules.teacher.model.Teacher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;
public interface TeacherRepository extends MongoRepository<Teacher, String> {
    Optional<Teacher> findByUserIdAndDeletedAtIsNull(String userId);
    Optional<Teacher> findByTeacherIdAndDeletedAtIsNull(String teacherId);
    Page<Teacher> findByDeletedAtIsNull(Pageable pageable);
    boolean existsByEmployeeIdAndDeletedAtIsNull(String employeeId);
}