package com.saas.school.modules.exam.repository;

import com.saas.school.modules.exam.model.ComponentInternalMark;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ComponentInternalMarkRepository extends MongoRepository<ComponentInternalMark, String> {

    /**
     * Find a single mark for (student, subject, component, year, term).
     * termId may be null for PER_YEAR-scheduled components.
     */
    Optional<ComponentInternalMark> findByStudentIdAndSubjectIdAndComponentKeyAndAcademicYearIdAndTermId(
            String studentId, String subjectId, String componentKey, String academicYearId, String termId);

    /** All internal marks for a student in a given academic year. Used by the report card aggregator. */
    List<ComponentInternalMark> findByStudentIdAndAcademicYearId(String studentId, String academicYearId);

    /** All internal marks for a student / subject combination in a year. */
    List<ComponentInternalMark> findByStudentIdAndSubjectIdAndAcademicYearId(
            String studentId, String subjectId, String academicYearId);
}
