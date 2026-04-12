package com.saas.school.modules.whatsapp.repository;

import com.saas.school.modules.whatsapp.model.WhatsAppMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface WhatsAppMessageRepository extends MongoRepository<WhatsAppMessage, String> {

    Page<WhatsAppMessage> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
