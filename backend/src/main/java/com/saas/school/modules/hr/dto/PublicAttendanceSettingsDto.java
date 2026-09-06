package com.saas.school.modules.hr.dto;

import com.saas.school.modules.hr.model.EmployeeAttendanceSettings;

/**
 * Read-only projection of {@link EmployeeAttendanceSettings} that any
 * authenticated employee can fetch — needed by the "My Attendance"
 * page to render the campus radius, decide whether to show the Mark
 * button (locationBasedEnabled), and prompt for OUT when
 * {@code expectedPunchesPerDay >= 2}.
 *
 * <p>Deliberately excludes admin-only fields like
 * {@code regularizationMonthlyCapPerEmployee} (relevant only to HR
 * and the regularization submit flow); those live on the full
 * settings DTO that HR uses.</p>
 */
public class PublicAttendanceSettingsDto {

    private boolean locationBasedEnabled;
    private boolean biometricBasedEnabled;
    private Double campusLatitude;
    private Double campusLongitude;
    private int allowedRadiusMeters;
    private int maxAccuracyMeters;
    private boolean rejectMockLocations;
    private int expectedPunchesPerDay;
    private String lateThreshold;
    private String halfDayThreshold;
    private boolean regularizationEnabled;
    private int regularizationMaxBackdateDays;

    public PublicAttendanceSettingsDto() {}

    public static PublicAttendanceSettingsDto from(EmployeeAttendanceSettings s) {
        PublicAttendanceSettingsDto d = new PublicAttendanceSettingsDto();
        d.locationBasedEnabled = s.isLocationBasedEnabled();
        d.biometricBasedEnabled = s.isBiometricBasedEnabled();
        d.campusLatitude = s.getCampusLatitude();
        d.campusLongitude = s.getCampusLongitude();
        d.allowedRadiusMeters = s.getAllowedRadiusMeters();
        d.maxAccuracyMeters = s.getMaxAccuracyMeters();
        d.rejectMockLocations = s.isRejectMockLocations();
        d.expectedPunchesPerDay = s.getExpectedPunchesPerDay();
        d.lateThreshold = s.getLateThreshold();
        d.halfDayThreshold = s.getHalfDayThreshold();
        d.regularizationEnabled = s.isRegularizationEnabled();
        d.regularizationMaxBackdateDays = s.getRegularizationMaxBackdateDays();
        return d;
    }

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
    public int getMaxAccuracyMeters() { return maxAccuracyMeters; }
    public void setMaxAccuracyMeters(int v) { this.maxAccuracyMeters = v; }
    public boolean isRejectMockLocations() { return rejectMockLocations; }
    public void setRejectMockLocations(boolean v) { this.rejectMockLocations = v; }
    public int getExpectedPunchesPerDay() { return expectedPunchesPerDay; }
    public void setExpectedPunchesPerDay(int v) { this.expectedPunchesPerDay = v; }
    public String getLateThreshold() { return lateThreshold; }
    public void setLateThreshold(String v) { this.lateThreshold = v; }
    public String getHalfDayThreshold() { return halfDayThreshold; }
    public void setHalfDayThreshold(String v) { this.halfDayThreshold = v; }
    public boolean isRegularizationEnabled() { return regularizationEnabled; }
    public void setRegularizationEnabled(boolean v) { this.regularizationEnabled = v; }
    public int getRegularizationMaxBackdateDays() { return regularizationMaxBackdateDays; }
    public void setRegularizationMaxBackdateDays(int v) { this.regularizationMaxBackdateDays = v; }
}
