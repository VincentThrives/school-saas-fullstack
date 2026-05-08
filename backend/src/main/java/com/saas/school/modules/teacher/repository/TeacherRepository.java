package com.saas.school.modules.teacher.repository;
import com.saas.school.modules.teacher.model.Teacher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;
import java.util.Optional;
public interface TeacherRepository extends MongoRepository<Teacher, String> {
    Optional<Teacher> findByUserIdAndDeletedAtIsNull(String userId);
    Optional<Teacher> findByTeacherIdAndDeletedAtIsNull(String teacherId);
    Page<Teacher> findByDeletedAtIsNull(Pageable pageable);
    boolean existsByEmployeeIdAndDeletedAtIsNull(String employeeId);
    long countByDeletedAtIsNull();

    /**
     * Find every (non-deleted) teacher who has any link to the given classId
     * via the three places we record those links:
     *   - classTeacherOfClassId (the class-teacher relationship)
     *   - classIds (legacy bulk-assignment list)
     *   - classSubjectAssignments[].classId (per-subject assignments)
     *
     * Used by NotificationService when expanding RecipientType.CLASS into
     * push recipients so teachers of the class get the buzz too — matches
     * the in-app inbox behaviour in {@code NotificationService.classIdsOf}.
     */
    @Query("{ '$or': [ " +
            "  { 'classTeacherOfClassId': ?0 }, " +
            "  { 'classIds': ?0 }, " +
            "  { 'classSubjectAssignments.classId': ?0 } " +
            "], 'deletedAt': null }")
    List<Teacher> findAllByAnyClassId(String classId);
}