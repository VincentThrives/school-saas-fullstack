package com.saas.school.modules.sms.model;

/**
 * What kind of event caused this SMS to be sent. Maps 1:1 to the
 * registered DLT template IDs in {@link com.saas.school.modules.sms.config.SmsConfig}.
 *
 * Keep this list in sync with:
 *   - the templates registered on STPL / approved by the operator
 *   - the trigger flags in {@link TenantSmsSettings}
 *   - the env vars in application.yml (MSG91_TPL_*)
 */
public enum SmsTrigger {
    /** Sent to parents when a student is marked absent. Template 1 (Active). */
    ABSENCE_ALERT,

    /** Sent when an exam result is published — combined view (all subjects). Template 2. */
    RESULT_COMBINED,

    /** Sent when a single-subject result is published. Template 3. */
    RESULT_SINGLE,

    /** Sent for custom school notices composed by an admin. Template 4. */
    CUSTOM_NOTICE,

    /** Sent when an admin announces a school closure / holiday. Template 5.
     *  Three vars: closure-date, reason, reopen-date. Tenant-only template
     *  — like every other trigger now, no platform fallback. Super Admin
     *  pastes the school's DLT entry on the SMS Control page's expanded
     *  row, the same way they paste Absence / Results / Custom. */
    HOLIDAY_NOTICE
}
