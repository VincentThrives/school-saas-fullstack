package com.saas.school.modules.exam.repository;
import com.saas.school.modules.exam.model.Exam;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface ExamRepository extends MongoRepository<Exam, String> {
    List<Exam> findByClassIdAndAcademicYearId(String classId, String academicYearId);
    List<Exam> findBySubjectIdAndAcademicYearId(String subjectId, String academicYearId);
    List<Exam> findByAcademicYearIdAndStatus(String academicYearId, Exam.ExamStatus status);
    List<Exam> findByClassId(String classId);
    long countByExamType(String examType);
    List<Exam> findByExamDate(java.time.LocalDate examDate);

    /**
     * Used by the bulk-create endpoint to detect duplicates before inserting.
     * Returns every exam matching (year, type, class, section, subject) — the
     * service then narrows by componentKey (per-component mode) or by
     * components-non-empty (combined mode).
     */
    List<Exam> findByAcademicYearIdAndExamTypeAndClassIdAndSectionIdAndSubjectId(
            String academicYearId, String examType, String classId, String sectionId, String subjectId);

    /**
     * Every exam belonging to an Exam Config group — the (year, examType)
     * tuple uniquely identifies a config that fanned out into many Exam
     * docs. Used by the Configs list, edit, and delete endpoints.
     */
    List<Exam> findByAcademicYearIdAndExamType(String academicYearId, String examType);
}