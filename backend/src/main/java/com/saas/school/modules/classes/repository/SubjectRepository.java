package com.saas.school.modules.classes.repository;

import com.saas.school.modules.classes.model.Subject;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface SubjectRepository extends MongoRepository<Subject, String> {

    /**
     * Subjects assigned to the given class within the given academic year.
     * Matches both the new {@code assignments} array (assignments-based
     * shape) and the legacy {@code classId} field on docs that haven't
     * been migrated yet — so the query keeps working through the
     * transition.
     */
    @Query("{ 'academicYearId': ?1, $or: [ { 'classId': ?0 }, { 'assignments.classId': ?0 } ] }")
    List<Subject> findByClassIdAndAcademicYearId(String classId, String academicYearId);

    List<Subject> findBySubjectIdIn(List<String> subjectIds);

    /**
     * Subjects in the legacy single-class shape that haven't been
     * migrated yet. Used by the boot-time migration runner that
     * converts {@code classId} into a single-entry {@code assignments}
     * list.
     */
    @Query("{ 'classId': { $exists: true, $ne: null }, $or: [ { 'assignments': { $exists: false } }, { 'assignments': null }, { 'assignments': { $size: 0 } } ] }")
    List<Subject> findLegacyUnmigrated();
}
