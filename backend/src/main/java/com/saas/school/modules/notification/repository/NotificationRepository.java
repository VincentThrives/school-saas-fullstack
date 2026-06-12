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

    /**
     * Admin / principal inbox feed. They see every BROADCAST — anything
     * sent to ALL, a ROLE, or a CLASS — so they can supervise the channel.
     * Per-student INDIVIDUAL notifications only surface when the admin is
     * actually one of the recipients, otherwise bulk fan-outs (Publish
     * Result for 50 students, etc.) flood the supervision inbox.
     */
    @Query("{ '$or': [" +
            "  { 'recipientType': 'ALL' }," +
            "  { 'recipientType': 'ROLE' }," +
            "  { 'recipientType': 'CLASS' }," +
            "  { 'recipientType': 'INDIVIDUAL', 'recipientIds': { '$in': [?0] } }" +
            "] }")
    Page<Notification> findForAdmin(String userId, Pageable pageable);

    /**
     * Unread count for the admin/principal inbox — same audience filter as
     * {@link #findForAdmin} so the badge tracks broadcasts + individually-
     * addressed notifications they haven't acknowledged yet, instead of
     * lighting up on every per-student bulk send.
     */
    @Query(value = "{ 'readBy': { '$nin': [?0] }, '$or': [" +
            "  { 'recipientType': 'ALL' }," +
            "  { 'recipientType': 'ROLE' }," +
            "  { 'recipientType': 'CLASS' }," +
            "  { 'recipientType': 'INDIVIDUAL', 'recipientIds': { '$in': [?0] } }" +
            "] }", count = true)
    long countUnreadForAdmin(String userId);
}

