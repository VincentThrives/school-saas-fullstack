package com.saas.school.modules.sms.dto;

/**
 * Shared audience selector for any SMS broadcast — used by both
 * custom-notice (school admin's free-text broadcast) and holiday-notice
 * (structured closure broadcast). Pulled to a top-level enum so the
 * two send flows don't depend on each other's DTOs.
 *
 * <p>Each value resolves to a set of userIds via
 * {@link com.saas.school.modules.sms.service.SmsService#resolveAudiences}.
 * The dispatch pipeline phone-dedupes across all resolved userIds, so
 * a teacher whose own child is a student doesn't receive the same SMS
 * twice when two audiences overlap.</p>
 */
public enum SmsAudience {
    /** All non-deleted users with a usable phone — parents + employees. */
    ALL,
    /** Parents of every active student. Falls back to the student's
     *  own User record when no parent is linked. */
    ALL_STUDENTS,
    /** Teachers, principal and school admins. */
    ALL_EMPLOYEES,
    /** Parents of students in one specific class — caller must
     *  provide a {@code classId}. */
    CLASS
}
