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

    Page<Student> findByAcademicYearIdAndDeletedAtIsNull(String academicYearId, Pageable pageable);

    Optional<Student> findByAdmissionNumberAndDeletedAtIsNull(String admissionNumber);
    Optional<Student> findByStudentIdAndDeletedAtIsNull(String studentId);

    List<Student> findByClassIdAndSectionIdAndDeletedAtIsNull(String classId, String sectionId);

    List<Student> findByParentIdsContainingAndDeletedAtIsNull(String parentId);

    @Query("{'$or':[{'rollNumber':{$regex:?0,$options:'i'}},{'admissionNumber':{$regex:?0,$options:'i'}}],'deletedAt':null}")
    Page<Student> searchStudents(String query, Pageable pageable);

    long countByClassIdAndDeletedAtIsNull(String classId);
    long countByDeletedAtIsNull();
}
