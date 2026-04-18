package com.saas.school.modules.notification.repository;

import com.saas.school.modules.notification.model.NotificationTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationTemplateRepository extends MongoRepository<NotificationTemplate, String> {
    List<NotificationTemplate> findAllByOrderByUpdatedAtDesc();
}
