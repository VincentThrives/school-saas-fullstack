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

    /**
     * Dedup lookup that includes componentKey — needed because a hybrid
     * subject can legitimately have two assignments for the same
     * teacher (one Theory, one Practical), distinguished only by
     * componentKey.
     *
     * <p>Mongo's derived-query null handling matches "field is absent"
     * when null is passed, which is the correct behaviour for
     * single-component subjects whose componentKey is null.
     */
    Optional<TeacherSubjectAssignment>
            findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectIdAndComponentKey(
                    String teacherId, String academicYearId, String classId, String sectionId,
                    String subjectId, String componentKey);

    long countByAcademicYearId(String academicYearId);
}
