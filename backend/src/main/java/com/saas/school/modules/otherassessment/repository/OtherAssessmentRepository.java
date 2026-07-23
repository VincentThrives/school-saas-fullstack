package com.saas.school.modules.otherassessment.repository;

import com.saas.school.modules.otherassessment.model.OtherAssessment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface OtherAssessmentRepository extends MongoRepository<OtherAssessment, String> {

    /** Admin list — every LIVE assessment for a class/section in the
     *  given academic year, most recent first. Soft-deleted rows
     *  ({@code deletedAt != null}) are hidden so the archive doesn't
     *  clutter the day-to-day admin view. */
    List<OtherAssessment> findByClassIdAndSectionIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
            String classId, String sectionId, String academicYearId);

    /** Coarser filter for a class across sections. Same soft-delete
     *  exclusion as the section-scoped variant. */
    List<OtherAssessment> findByClassIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
            String classId, String academicYearId);

    /** Every live assessment for a year — used by student-side views.
     *  Soft-deleted excluded. */
    List<OtherAssessment> findByAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(String academicYearId);

    // ── Archive views — same filters, only ARCHIVED (deletedAt set) ─

    List<OtherAssessment> findByClassIdAndSectionIdAndAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(
            String classId, String sectionId, String academicYearId);

    List<OtherAssessment> findByClassIdAndAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(
            String classId, String academicYearId);

    List<OtherAssessment> findByAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String academicYearId);
}
