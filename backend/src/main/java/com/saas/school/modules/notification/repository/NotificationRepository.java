package com.saas.school.modules.notification.repository;
import com.saas.school.modules.notification.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;
public interface NotificationRepository extends MongoRepository<Notification, String> {
    @Query("{'$or':[{'recipientType':'ALL'},{'recipientIds':{$in:[?0]}},{'recipientRole':?1}]}")
    Page<Notification> findForUser(String userId, String role, Pageable pageable);
    @Query("{'recipientIds':{$in:[?0]},'readBy':{$not:{$in:[?0]}}}")
    List<Notification> findUnreadByUser(String userId);
}