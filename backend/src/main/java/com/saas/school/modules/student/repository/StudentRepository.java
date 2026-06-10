package com.saas.school.modules.student.repository;

import com.saas.school.modules.student.model.Student;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StudentRepository extends MongoRepository<Student, String> {

    Page<Student> findByClassIdAndSectionIdAndDeletedAtIsNull(
            String classId, String sectionId, Pageable pageable);

    Page<Student> findByClassIdAndDeletedAtIsNull(String classId, Pageable pageable);

    /** Non-paginated list of students in a class — used by NotificationService
     *  to expand RecipientType.CLASS into a concrete list of userIds for push.
     *  Distinct method name from the Page variant above so Spring Data binds
     *  to the correct return type. */
    List<Student> findAllByClassIdAndDeletedAtIsNull(String classId);

    Page<Student> findByAcademicYearIdAndDeletedAtIsNull(String academicYearId, Pageable pageable);

    Optional<Student> findByAdmissionNumberAndDeletedAtIsNull(String admissionNumber);
    Optional<Student> findByStudentIdAndDeletedAtIsNull(String studentId);

    /** Bulk-import final-mile uniqueness check — pulls every conflicting
     *  student in one query so the importer doesn't make N round-trips. */
    List<Student> findByAdmissionNumberInAndDeletedAtIsNull(List<String> admissionNumbers);

    List<Student> findByClassIdAndSectionIdAndDeletedAtIsNull(String classId, String sectionId);

    List<Student> findByParentIdsContainingAndDeletedAtIsNull(String parentId);

    @Query("{'$or':[{'rollNumber':{$regex:?0,$options:'i'}},{'admissionNumber':{$regex:?0,$options:'i'}}],'deletedAt':null}")
    Page<Student> searchStudents(String query, Pageable pageable);

    Page<Student> findByDeletedAtIsNull(Pageable pageable);
    List<Student> findByDeletedAtIsNull();

    long countByClassIdAndDeletedAtIsNull(String classId);
    long countByDeletedAtIsNull();

    Optional<Student> findByUserIdAndDeletedAtIsNull(String userId);
}
