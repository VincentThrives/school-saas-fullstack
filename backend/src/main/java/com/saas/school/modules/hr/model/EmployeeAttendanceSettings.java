package com.saas.school.modules.hr.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-tenant configuration for the employee-attendance module. One
 * document per tenant, lazily created on first read (see
 * {@code EmployeeAttendanceSettingsService.getOrDefault}) so
 * onboarding a new school doesn't require a seed step.
 *
 * <p>Kept separate from the biometric-terminal settings (which are
 * tenant-wide but hardware-specific) because a school might use
 * location-based marking without any hardware — bundling them would
 * force every field to be filled even for hardware-less tenants.</p>
 */
@Document(collection = "employee_attendance_settings")
public class EmployeeAttendanceSettings {

    @Id
    private String id;

    /** One row per tenant. The application-level guarantee (the
     *  service does {@code findByTenantId}) is enforced by this
     *  unique index so a duplicate insert from two concurrent HR
     *  saves would fail cleanly instead of silently forking. */
    @Indexed(unique = true)
    private String tenantId;

    // ── Method toggles ────────────────────────────────────────

    /** Location-based self-marking (employee opens app + hits button). */
    private boolean locationBasedEnabled = false;

    /** Biometric terminal (eSSL) writes into employee_attendance too.
     *  Independent of the students biometric feature-flag — a school
     *  can have terminals for students but not for staff. */
    private boolean biometricBasedEnabled = false;

    // ── Location config (LOCATION source only) ────────────────

    /** Campus centre-point latitude (WGS84). Set once via the HR
     *  Settings map picker. */
    private Double campusLatitude;
    private Double campusLongitude;

    /** How far from the campus centre a mark is still valid. Default
     *  200 m is a comfortable single-block radius — small enough that
     *  a house across the road is out but a courtyard corner isn't. */
    private int allowedRadiusMeters = 200;

    /** Reject marks flagged as coming from a mock GPS provider
     *  (Android developer options). Turning this off is a per-school
     *  choice — some schools accept the risk for staff working from
     *  the on-site accommodation who use privacy-conscious ROMs. */
    private boolean rejectMockLocations = true;

    /** Reject marks with reported GPS accuracy worse than this many
     *  metres. 100 m is the sweet spot — indoor Wi-Fi triangulation
     *  can drift up to 80 m and we don't want to accidentally reject
     *  those; anything above 100 m is basically noise. */
    private int maxAccuracyMeters = 100;

    // ── Punch rules ──────────────────────────────────────────

    /** 1 = IN only. 2 = IN + OUT. Higher values reserved for future
     *  split-shift support (lunch in/out). */
    private int expectedPunchesPerDay = 2;

    // ── Time rules (all in tenant timezone — Asia/Kolkata) ────

    /** "HH:mm" — the moment "on-time" ends. Marks at or after this
     *  are flagged {@link EmployeeAttendance#isLate()}. */
    private String lateThreshold = "09:15";

    /**
     * Legacy IN-time threshold — marks after this used to count as
     * HALF_DAY. Retained on the schema so older tenant docs still
     * deserialize, but the compute path now uses
     * {@link #halfDayCalculationEnabled} + {@link #halfDayMaxHours}
     * instead. The IN-time rule mis-classified afternoon half-days
     * (person arrives 13:00 for a legit afternoon shift, gets
     * flagged HALF_DAY).
     *
     * @deprecated Kept for backward-compat reads only.
     */
    @Deprecated
    private String halfDayThreshold = "11:00";

    /**
     * When true, an employee whose OUT − IN duration is less than
     * {@link #halfDayMaxHours} is stamped HALF_DAY instead of
     * PRESENT. Only fires on OUT — until the second punch lands we
     * can't measure duration, so the day stays PRESENT/LATE.
     *
     * <p>Doesn't apply to 1-punch tenants (no OUT = no duration).
     * HR-manual rows respect whatever status HR picks and are not
     * overridden.</p>
     */
    private boolean halfDayCalculationEnabled = true;

    /**
     * Total-hours-worked threshold — hours strictly less than this
     * count as HALF_DAY. Default 4.0 covers a "half-shift" of a
     * standard 8-hour school day; the tenant can raise this for
     * longer standard shifts.
     */
    private double halfDayMaxHours = 4.0;

    /** "HH:mm" — the auto-absent scheduled job stamps ABSENT on any
     *  employee still unmarked after this time. Runs once daily. */
    private String autoAbsentTime = "11:00";

    /** Auto-absent job enabled. Off by default so schools that use
     *  admin-only manual marking aren't surprised by rows appearing
     *  on their own. */
    private boolean autoAbsentEnabled = false;

    /**
     * Auto-OUT job — stamps OUT at {@link #autoOutTime} on any
     * employee who punched IN today but hasn't punched OUT by the
     * time the job runs. Closes the "employee forgot to punch out"
     * loophole so the half-day rule (hours-worked) can fire
     * correctly without waiting for a regularization request.
     *
     * <p>Off by default — enabling it is an explicit policy call
     * (some schools want the missing OUT to stay visible until
     * manually resolved).</p>
     */
    private boolean autoOutEnabled = false;

    /** "HH:mm" — the OUT time stamped on rows missing an OUT punch.
     *  Default 18:30 sits after a typical Indian school day end
     *  (~15:00 for kids, ~17:00 for teachers with prep). */
    private String autoOutTime = "18:30";

    // ── Regularization rules ────────────────────────────────

    /** Master toggle for the regularization workflow. When off the
     *  "Submit regularization" link is hidden on My Attendance and
     *  the HR approvals queue is empty. */
    private boolean regularizationEnabled = true;

    /** How many days back a request may reach. Anything older than
     *  {@code today - N} is refused up front so HR isn't flooded with
     *  months-late claims. */
    private int regularizationMaxBackdateDays = 7;

    /** Per-employee monthly cap on regularization requests — prevents
     *  the "just fill it in anyway" abuse pattern. Zero = unlimited. */
    private int regularizationMonthlyCapPerEmployee = 3;

    /** Auto-approve regularizations submitted within N minutes of the
     *  configured shift start (i.e. late-registered but same-morning
     *  requests that HR would rubber-stamp anyway). Zero disables
     *  auto-approval — every request goes to the HR queue. */
    private int regularizationAutoApproveWindowMinutes = 30;

    // ── Audit ───────────────────────────────────────────────

    private Instant updatedAt;
    private String updatedByUserId;

    public EmployeeAttendanceSettings() {}

    public EmployeeAttendanceSettings(String tenantId) {
        this.tenantId = tenantId;
    }

    // ── Getters / setters ──────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public boolean isLocationBasedEnabled() { return locationBasedEnabled; }
    public void setLocationBasedEnabled(boolean v) { this.locationBasedEnabled = v; }

    public boolean isBiometricBasedEnabled() { return biometricBasedEnabled; }
    public void setBiometricBasedEnabled(boolean v) { this.biometricBasedEnabled = v; }

    public Double getCampusLatitude() { return campusLatitude; }
    public void setCampusLatitude(Double v) { this.campusLatitude = v; }

    public Double getCampusLongitude() { return campusLongitude; }
    public void setCampusLongitude(Double v) { this.campusLongitude = v; }

    public int getAllowedRadiusMeters() { return allowedRadiusMeters; }
    public void setAllowedRadiusMeters(int v) { this.allowedRadiusMeters = v; }

    public boolean isRejectMockLocations() { return rejectMockLocations; }
    public void setRejectMockLocations(boolean v) { this.rejectMockLocations = v; }

    public int getMaxAccuracyMeters() { return maxAccuracyMeters; }
    public void setMaxAccuracyMeters(int v) { this.maxAccuracyMeters = v; }

    public int getExpectedPunchesPerDay() { return expectedPunchesPerDay; }
    public void setExpectedPunchesPerDay(int v) { this.expectedPunchesPerDay = v; }

    public String getLateThreshold() { return lateThreshold; }
    public void setLateThreshold(String v) { this.lateThreshold = v; }

    public String getHalfDayThreshold() { return halfDayThreshold; }
    public void setHalfDayThreshold(String v) { this.halfDayThreshold = v; }

    public boolean isHalfDayCalculationEnabled() { return halfDayCalculationEnabled; }
    public void setHalfDayCalculationEnabled(boolean v) { this.halfDayCalculationEnabled = v; }

    public double getHalfDayMaxHours() { return halfDayMaxHours; }
    public void setHalfDayMaxHours(double v) { this.halfDayMaxHours = v; }

    public String getAutoAbsentTime() { return autoAbsentTime; }
    public void setAutoAbsentTime(String v) { this.autoAbsentTime = v; }

    public boolean isAutoAbsentEnabled() { return autoAbsentEnabled; }
    public void setAutoAbsentEnabled(boolean v) { this.autoAbsentEnabled = v; }

    public boolean isAutoOutEnabled() { return autoOutEnabled; }
    public void setAutoOutEnabled(boolean v) { this.autoOutEnabled = v; }

    public String getAutoOutTime() { return autoOutTime; }
    public void setAutoOutTime(String v) { this.autoOutTime = v; }

    public boolean isRegularizationEnabled() { return regularizationEnabled; }
    public void setRegularizationEnabled(boolean v) { this.regularizationEnabled = v; }

    public int getRegularizationMaxBackdateDays() { return regularizationMaxBackdateDays; }
    public void setRegularizationMaxBackdateDays(int v) { this.regularizationMaxBackdateDays = v; }

    public int getRegularizationMonthlyCapPerEmployee() { return regularizationMonthlyCapPerEmployee; }
    public void setRegularizationMonthlyCapPerEmployee(int v) { this.regularizationMonthlyCapPerEmployee = v; }

    public int getRegularizationAutoApproveWindowMinutes() { return regularizationAutoApproveWindowMinutes; }
    public void setRegularizationAutoApproveWindowMinutes(int v) { this.regularizationAutoApproveWindowMinutes = v; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(String updatedByUserId) { this.updatedByUserId = updatedByUserId; }
}
