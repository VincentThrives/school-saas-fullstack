package com.saas.school.modules.notification.repository;

import com.saas.school.modules.notification.model.ResultPublication;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ResultPublicationRepository extends MongoRepository<ResultPublication, String> {

    /**
     * Lookup-by-scope used by the preview endpoint to surface
     * "already published on …" warnings, and by publish() to enforce
     * the republish-confirmation rule. {@code subjectIdKey} is either
     * a real subjectId or {@link ResultPublication#ALL_SUBJECTS_KEY}
     * when the publication covers every subject.
     */
    Optional<ResultPublication> findByExamTypeAndClassIdAndSectionIdAndSubjectIdKey(
            String examType, String classId, String sectionId, String subjectIdKey);
}
