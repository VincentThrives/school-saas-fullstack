package com.saas.school.modules.sms.repository;

import com.saas.school.modules.sms.model.SmsAuditLog;
import com.saas.school.modules.sms.model.SmsTrigger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface SmsAuditLogRepository extends MongoRepository<SmsAuditLog, String> {

    /** Tenant-scoped audit log — school admin paginates their own school's history. */
    Page<SmsAuditLog> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    /** Trigger filter for the audit log UI. */
    Page<SmsAuditLog> findByTenantIdAndTriggerOrderByCreatedAtDesc(
            String tenantId, SmsTrigger trigger, Pageable pageable);

    /** Used by the webhook to update SENT → DELIVERED once MSG91 confirms. */
    Optional<SmsAuditLog> findByMsg91MessageId(String msg91MessageId);

    /** Monthly cost rollup — SmsService calls this when fresh-month-detected
     *  to seed costUsedThisMonth from actual rows rather than trusting the
     *  cached counter (defensive). */
    @Query(value = "{ 'tenantId': ?0, 'status': { $in: ['SENT', 'DELIVERED'] }, " +
                   "  'createdAt': { $gte: ?1 } }",
           fields = "{ 'costInr': 1 }")
    java.util.List<SmsAuditLog> findCostsSinceForTenant(String tenantId, Instant since);

    /** Idempotency check for the manual "send today's absent SMS" flow.
     *  Returns audit rows for the given (tenant, trigger, relatedEntityType,
     *  studentIds, status, since) tuple — the caller pulls
     *  {@code relatedEntityId} out of each row to build the "already sent"
     *  set so it can be skipped.
     *
     *  Statuses included: {@code SENT, DELIVERED, PENDING}. SKIPPED + FAILED
     *  are deliberately NOT included — those are eligible for retry. */
    @Query("{ 'tenantId': ?0, 'trigger': ?1, " +
           "  'relatedEntityType': ?2, " +
           "  'relatedEntityId': { $in: ?3 }, " +
           "  'status': { $in: ['SENT', 'DELIVERED', 'PENDING'] }, " +
           "  'createdAt': { $gte: ?4 } }")
    java.util.List<SmsAuditLog> findExistingForEntities(
            String tenantId, SmsTrigger trigger, String relatedEntityType,
            java.util.Collection<String> entityIds, Instant since);
}
