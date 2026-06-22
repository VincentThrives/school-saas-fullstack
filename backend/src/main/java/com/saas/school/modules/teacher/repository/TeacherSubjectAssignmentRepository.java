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

    /**
     * Dedupe lookup that spans the full unique tuple, including the
     * teaching {@code subPartKey} (Physics / Chemistry / Biology under
     * an integrated Science course). Required because the compound
     * unique index now includes subPartKey — a Physics + Chemistry pair
     * for the same teacher, year, class, section, subject and
     * componentKey is two valid rows, not a collision.
     */
    Optional<TeacherSubjectAssignment>
            findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectIdAndComponentKeyAndSubPartKey(
                    String teacherId, String academicYearId, String classId, String sectionId,
                    String subjectId, String componentKey, String subPartKey);

    long countByAcademicYearId(String academicYearId);
}
