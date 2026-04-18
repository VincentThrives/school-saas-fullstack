package com.saas.school.modules.notification.repository;

import com.saas.school.modules.notification.model.NotificationFireLog;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationFireLogRepository extends MongoRepository<NotificationFireLog, String> {
    boolean existsByRuleKeyAndEntityIdAndDateKey(String ruleKey, String entityId, String dateKey);
}
