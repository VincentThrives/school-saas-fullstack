package com.saas.school.modules.biometricterminal.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Per-tenant biometric attendance configuration. Stored as a singleton
 * document (fixed {@code _id = "settings"}) in each tenant's own DB.
 *
 * <p>Kept in the tenant DB rather than on the master {@code Tenant}
 * document because this is operational config the attendance flow
 * reads on every scan; keeping it in the tenant DB avoids the
 * clear-and-restore {@code TenantContext} dance that master-DB reads
 * require, and lets each school's config live and back up alongside
 * their own students / attendance data.</p>
 */
@Document(collection = "biometric_settings")
public class BiometricSettings {

    /** Singleton id — always "settings". Only one doc per tenant DB. */
    public static final String SINGLETON_ID = "settings";

    @Id
    private String id = SINGLETON_ID;

    /** HH:mm 24h. IN scans after this time are marked LATE. */
    private String lateCutoff = "09:15";

    /**
     * HH:mm 24h. Scans at or after this time are treated as EXIT scans;
     * scans before this time are treated as ENTRY scans. The device's
     * IN/OUT byte is ignored — many eSSL setups always report status=0,
     * so time-based inference is more reliable than trusting the device.
     */
    private String earliestExitTime = "14:00";

    /**
     * Number of meaningful scans per student per day. 1 = entry only
     * (schools that don't track exit — parents get 1 SMS/day). 2 =
     * entry + exit (parents get up to 2 SMS/day). Any scans beyond
     * this quota are silently dropped (audit-logged but no attendance
     * update, no notification). Default 2.
     */
    private int expectedScansPerDay = 2;

    /**
     * HH:mm 24h. When set + {@link #absentAutoMarkEnabled} is true,
     * a scheduled job at this time marks any student who hasn't
     * scanned IN yet today as ABSENT and fires an in-app notification
     * to the parent. Null / blank = disabled.
     */
    private String absentAutoMarkTime = "10:30";

    /**
     * Opt-in per tenant. When false, no auto-absent job runs for this
     * school — teachers still mark attendance the old way. Default off
     * so existing tenants don't get surprise auto-absent behavior when
     * this ships; admins turn it on from the Biometric Settings page.
     */
    private boolean absentAutoMarkEnabled = false;

    /** Parent SMS on IN scan. */
    private boolean notifyOnEntry = true;

    /** Parent SMS on OUT scan. Off by default — daily dismissal noise. */
    private boolean notifyOnExit = false;

    /** Parent SMS on EARLY_LEAVE OUT scans. Recommended on — this is
     *  the ping that parents actually value. */
    private boolean notifyOnEarlyLeave = true;

    public BiometricSettings() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getLateCutoff() { return lateCutoff; }
    public void setLateCutoff(String lateCutoff) { this.lateCutoff = lateCutoff; }

    public String getEarliestExitTime() { return earliestExitTime; }
    public void setEarliestExitTime(String earliestExitTime) { this.earliestExitTime = earliestExitTime; }

    public int getExpectedScansPerDay() { return expectedScansPerDay; }
    public void setExpectedScansPerDay(int expectedScansPerDay) { this.expectedScansPerDay = expectedScansPerDay; }

    public String getAbsentAutoMarkTime() { return absentAutoMarkTime; }
    public void setAbsentAutoMarkTime(String absentAutoMarkTime) { this.absentAutoMarkTime = absentAutoMarkTime; }

    public boolean isAbsentAutoMarkEnabled() { return absentAutoMarkEnabled; }
    public void setAbsentAutoMarkEnabled(boolean absentAutoMarkEnabled) { this.absentAutoMarkEnabled = absentAutoMarkEnabled; }

    public boolean isNotifyOnEntry() { return notifyOnEntry; }
    public void setNotifyOnEntry(boolean notifyOnEntry) { this.notifyOnEntry = notifyOnEntry; }

    public boolean isNotifyOnExit() { return notifyOnExit; }
    public void setNotifyOnExit(boolean notifyOnExit) { this.notifyOnExit = notifyOnExit; }

    public boolean isNotifyOnEarlyLeave() { return notifyOnEarlyLeave; }
    public void setNotifyOnEarlyLeave(boolean notifyOnEarlyLeave) { this.notifyOnEarlyLeave = notifyOnEarlyLeave; }
}
