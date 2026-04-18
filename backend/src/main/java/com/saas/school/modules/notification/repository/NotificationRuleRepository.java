package com.saas.school.modules.notification.repository;

import com.saas.school.modules.notification.model.NotificationRule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRuleRepository extends MongoRepository<NotificationRule, String> {
    List<NotificationRule> findAllByOrderByNameAsc();
    Optional<NotificationRule> findByRuleKey(String ruleKey);
    boolean existsByRuleKey(String ruleKey);
}
