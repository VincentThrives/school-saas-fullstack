package com.saas.school.modules.biometricterminal.repository;

import com.saas.school.modules.biometricterminal.model.AutoAbsentLog;
import org.springframework.data.mongodb.repository.MongoRepository;

/** Per-tenant DB. {@code findById(dateKey)} answers "did we already
 *  run the auto-absent job for this date?". */
public interface AutoAbsentLogRepository extends MongoRepository<AutoAbsentLog, String> {
}
