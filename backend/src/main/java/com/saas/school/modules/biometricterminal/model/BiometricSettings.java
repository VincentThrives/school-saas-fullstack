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

    /** HH:mm 24h. OUT scans before this time are marked EARLY_LEAVE. */
    private String earliestExitTime = "14:00";

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

    public boolean isNotifyOnEntry() { return notifyOnEntry; }
    public void setNotifyOnEntry(boolean notifyOnEntry) { this.notifyOnEntry = notifyOnEntry; }

    public boolean isNotifyOnExit() { return notifyOnExit; }
    public void setNotifyOnExit(boolean notifyOnExit) { this.notifyOnExit = notifyOnExit; }

    public boolean isNotifyOnEarlyLeave() { return notifyOnEarlyLeave; }
    public void setNotifyOnEarlyLeave(boolean notifyOnEarlyLeave) { this.notifyOnEarlyLeave = notifyOnEarlyLeave; }
}
