package com.saas.school.modules.tenant.model;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Catalog of sidenav modules that can be toggled on / off for the
 * {@link com.saas.school.modules.user.model.UserRole#SCHOOL_STAFF}
 * role at the tenant level. The school admin manages these gates
 * from the Staff Access page; each key here corresponds to one
 * sidenav item the staff role can see.
 *
 * <p>Modules deliberately NOT on this list — never togglable, never
 * visible to staff — include:</p>
 * <ul>
 *   <li>User management (Manage Users, Staff Access itself)</li>
 *   <li>Super-admin screens (SMS Control, Tenant settings)</li>
 *   <li>Dashboard — always shown as the entry point</li>
 * </ul>
 *
 * <p>The string values are persisted on
 * {@link Tenant#getStaffEnabledModules()} and surfaced in JWT-aware
 * endpoint checks. Keep them stable — renames are a data migration.</p>
 */
public enum StaffModule {
    ATTENDANCE,
    EXAMS,
    SMS,
    NOTIFICATIONS,
    FEES,
    REPORT_CARDS,
    EVENTS,
    TIMETABLE,
    SUBJECTS,
    CLASSES,
    ACADEMIC_YEARS,
    STUDENTS,
    TEACHERS;

    /** All catalog keys as strings — used as the default
     *  {@code staffEnabledModules} when a tenant hasn't customised the
     *  page yet (full access). */
    public static List<String> allKeys() {
        return Arrays.stream(values()).map(Enum::name).collect(Collectors.toList());
    }
}
