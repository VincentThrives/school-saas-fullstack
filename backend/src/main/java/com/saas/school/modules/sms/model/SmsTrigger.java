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
    HOLIDAY_NOTICE,

    /** Sent when an admin announces a school event — fired from the
     *  Events page's per-card "Send SMS" action. Three vars:
     *  event-name, event-date, venue (or description). Tenant-only
     *  template — Super Admin pastes the school's DLT entry on the SMS
     *  Control page's expanded row. */
    EVENT_NOTICE,

    /**
     * Sent to parents when a student's biometric terminal records an IN
     * scan (child arrived at school). Fired from
     * {@code AttendanceScanService.maybeNotifyParents} alongside the
     * in-app push. Three vars: student-name, class + section, time.
     *
     * <p>Reference template body:<br>
     * {@code Dear Parent, your ward ##var1## of Class ##var2## entered
     * the school at ##var3##. -Manjushree English School}</p>
     *
     * <p>Tenant-only template — Super Admin pastes the school's own
     * DLT entry on the SMS Control page.</p>
     */
    BIOMETRIC_ENTRY,

    /**
     * Sent to parents when a student's biometric terminal records an
     * OUT scan (child left school). Same three vars as
     * {@link #BIOMETRIC_ENTRY}: student-name, class + section, time.
     *
     * <p>Reference template body:<br>
     * {@code Dear Parent, your ward ##var1## of Class ##var2## left
     * the school at ##var3##, Thank you. -Manjushree English School}</p>
     */
    BIOMETRIC_EXIT
}
