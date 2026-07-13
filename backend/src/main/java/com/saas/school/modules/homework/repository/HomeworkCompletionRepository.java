package com.saas.school.modules.homework.repository;

import com.saas.school.modules.homework.model.HomeworkCompletion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface HomeworkCompletionRepository extends MongoRepository<HomeworkCompletion, String> {

    /** Roster lookup for a specific homework — one doc read. */
    Optional<HomeworkCompletion> findByHomeworkId(String homeworkId);

    /** Batched lookup for the student Homework page: fetch every
     *  completion doc for today's homework in one round-trip so we
     *  can render pending/done status per row without N+1 reads. */
    List<HomeworkCompletion> findByHomeworkIdIn(Collection<String> homeworkIds);
}
