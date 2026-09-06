package com.saas.school.modules.hr.dto;

/**
 * Body for {@code POST /api/v1/hr/attendance/mark-self}. Any
 * authenticated user with a linked {@code employeeId} can call it —
 * the endpoint is intentionally NOT gated by the HR role, since
 * teachers, principals, coordinators etc all need to be able to
 * punch in via location. HR-only endpoints (settings, daily view,
 * manual entry) live on separate controllers.
 *
 * <p>All location fields are optional at the DTO level so a
 * biometric-only tenant could reuse this same shape in future for
 * a fallback path; the service layer validates that lat/lng are
 * present when the tenant has {@code locationBasedEnabled = true}.</p>
 */
public class MarkSelfAttendanceRequest {

    /** Browser Geolocation lat in WGS84. */
    private Double latitude;
    /** Browser Geolocation lng in WGS84. */
    private Double longitude;
    /** GPS accuracy the browser reported (metres). Compared against
     *  the tenant's {@code maxAccuracyMeters} before the geofence
     *  check — a 500 m radius mark on a device reporting 300 m
     *  accuracy is meaningless. */
    private Double accuracyMeters;
    /** True when the browser flagged the location as coming from a
     *  mock GPS provider (Android developer options). The service
     *  rejects when the tenant has {@code rejectMockLocations = true}. */
    private boolean mocked;

    public MarkSelfAttendanceRequest() {}

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double v) { this.latitude = v; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double v) { this.longitude = v; }

    public Double getAccuracyMeters() { return accuracyMeters; }
    public void setAccuracyMeters(Double v) { this.accuracyMeters = v; }

    public boolean isMocked() { return mocked; }
    public void setMocked(boolean v) { this.mocked = v; }
}
