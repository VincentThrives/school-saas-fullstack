package com.saas.school.modules.notification.repository;
import com.saas.school.modules.notification.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Collection;
import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    /**
     * Notifications visible to a given user based on four targeting modes:
     *   - recipientType = "ALL"
     *   - recipientType = "ROLE" and recipientRole == {role}
     *   - recipientType = "INDIVIDUAL" and userId is in recipientIds
     *   - recipientType = "CLASS" and recipientClassId is in {classIds}
     * Sorted by sentAt desc via Pageable.
     */
    @Query("{ '$or': [" +
            "  { 'recipientType': 'ALL' }," +
            "  { 'recipientType': 'ROLE', 'recipientRole': ?1 }," +
            "  { 'recipientType': 'INDIVIDUAL', 'recipientIds': { '$in': [?0] } }," +
            "  { 'recipientType': 'CLASS', 'recipientClassId': { '$in': ?2 } }" +
            "] }")
    Page<Notification> findForUser(String userId, String role, Collection<String> classIds, Pageable pageable);

    /** Unread subset of findForUser — same $or targeting + user not in readBy. */
    @Query("{ 'readBy': { '$nin': [?0] }, '$or': [" +
            "  { 'recipientType': 'ALL' }," +
            "  { 'recipientType': 'ROLE', 'recipientRole': ?1 }," +
            "  { 'recipientType': 'INDIVIDUAL', 'recipientIds': { '$in': [?0] } }," +
            "  { 'recipientType': 'CLASS', 'recipientClassId': { '$in': ?2 } }" +
            "] }")
    List<Notification> findUnreadForUser(String userId, String role, Collection<String> classIds);

    // Kept for backwards compat
    @Query("{'recipientIds':{$in:[?0]},'readBy':{$not:{$in:[?0]}}}")
    List<Notification> findUnreadByUser(String userId);

    /** Notifications the admin/teacher themselves sent — used by the History tab. */
    Page<Notification> findByCreatedByOrderBySentAtDesc(String createdBy, Pageable pageable);
}

