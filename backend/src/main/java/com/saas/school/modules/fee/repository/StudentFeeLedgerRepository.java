package com.saas.school.modules.fee.repository;

import com.saas.school.modules.fee.model.StudentFeeLedger;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentFeeLedgerRepository extends MongoRepository<StudentFeeLedger, String> {

    Optional<StudentFeeLedger> findByStudentIdAndAcademicYearId(String studentId, String academicYearId);

    List<StudentFeeLedger> findByAcademicYearId(String academicYearId);

    List<StudentFeeLedger> findByClassIdAndAcademicYearId(String classId, String academicYearId);

    List<StudentFeeLedger> findByClassIdAndSectionIdAndAcademicYearId(
            String classId, String sectionId, String academicYearId);

    List<StudentFeeLedger> findByAcademicYearIdAndStatus(String academicYearId, StudentFeeLedger.Status status);

    long countByAcademicYearId(String academicYearId);
}
