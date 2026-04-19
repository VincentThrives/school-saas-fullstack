package com.saas.school.modules.teacher.repository;

import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TeacherSubjectAssignmentRepository extends MongoRepository<TeacherSubjectAssignment, String> {

    List<TeacherSubjectAssignment> findByTeacherIdAndAcademicYearId(String teacherId, String academicYearId);

    List<TeacherSubjectAssignment> findByAcademicYearId(String academicYearId);

    List<TeacherSubjectAssignment> findByTeacherId(String teacherId);

    List<TeacherSubjectAssignment> findByClassIdAndAcademicYearId(String classId, String academicYearId);

    List<TeacherSubjectAssignment> findByClassIdAndSectionIdAndAcademicYearId(
            String classId, String sectionId, String academicYearId);

    Optional<TeacherSubjectAssignment> findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectId(
            String teacherId, String academicYearId, String classId, String sectionId, String subjectId);

    long countByAcademicYearId(String academicYearId);
}
