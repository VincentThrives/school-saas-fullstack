package com.saas.school.modules.syllabus.repository;

import com.saas.school.modules.syllabus.model.Syllabus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SyllabusRepository extends MongoRepository<Syllabus, String> {

    List<Syllabus> findByClassIdAndAcademicYearId(String classId, String academicYearId);

    List<Syllabus> findByTeacherIdAndAcademicYearId(String teacherId, String academicYearId);

    Optional<Syllabus> findByClassIdAndSubjectIdAndAcademicYearId(String classId, String subjectId, String academicYearId);
}
