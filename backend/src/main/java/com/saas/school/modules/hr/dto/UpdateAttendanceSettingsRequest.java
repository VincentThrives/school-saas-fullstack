package com.saas.school.modules.hr.dto;

/**
 * Partial update — HR posts only the fields they changed on the
 * Settings page. Every field is nullable / defaulted; the service
 * copies non-null values onto the persisted document so a single-
 * toggle flip doesn't need to resend the whole configuration.
 */
public class UpdateAttendanceSettingsRequest {

    private Boolean locationBasedEnabled;
    private Boolean biometricBasedEnabled;

    private Double campusLatitude;
    private Double campusLongitude;
    private Integer allowedRadiusMeters;
    private Boolean rejectMockLocations;
    private Integer maxAccuracyMeters;

    private Integer expectedPunchesPerDay;
    private String  lateThreshold;
    private String  halfDayThreshold;
    /** New half-day rule — hours-worked based. */
    private Boolean halfDayCalculationEnabled;
    private Double  halfDayMaxHours;
    private String  autoAbsentTime;
    private Boolean autoAbsentEnabled;
    /** Auto-OUT rule — stamps OUT on rows with IN-but-no-OUT so the
     *  half-day computation can fire without a regularization request. */
    private Boolean autoOutEnabled;
    private String  autoOutTime;

    private Boolean regularizationEnabled;
    private Integer regularizationMaxBackdateDays;
    private Integer regularizationMonthlyCapPerEmployee;
    private Integer regularizationAutoApproveWindowMinutes;

    public UpdateAttendanceSettingsRequest() {}

    public Boolean getLocationBasedEnabled() { return locationBasedEnabled; }
    public void setLocationBasedEnabled(Boolean v) { this.locationBasedEnabled = v; }

    public Boolean getBiometricBasedEnabled() { return biometricBasedEnabled; }
    public void setBiometricBasedEnabled(Boolean v) { this.biometricBasedEnabled = v; }

    public Double getCampusLatitude() { return campusLatitude; }
    public void setCampusLatitude(Double v) { this.campusLatitude = v; }

    public Double getCampusLongitude() { return campusLongitude; }
    public void setCampusLongitude(Double v) { this.campusLongitude = v; }

    public Integer getAllowedRadiusMeters() { return allowedRadiusMeters; }
    public void setAllowedRadiusMeters(Integer v) { this.allowedRadiusMeters = v; }

    public Boolean getRejectMockLocations() { return rejectMockLocations; }
    public void setRejectMockLocations(Boolean v) { this.rejectMockLocations = v; }

    public Integer getMaxAccuracyMeters() { return maxAccuracyMeters; }
    public void setMaxAccuracyMeters(Integer v) { this.maxAccuracyMeters = v; }

    public Integer getExpectedPunchesPerDay() { return expectedPunchesPerDay; }
    public void setExpectedPunchesPerDay(Integer v) { this.expectedPunchesPerDay = v; }

    public String getLateThreshold() { return lateThreshold; }
    public void setLateThreshold(String v) { this.lateThreshold = v; }

    public String getHalfDayThreshold() { return halfDayThreshold; }
    public void setHalfDayThreshold(String v) { this.halfDayThreshold = v; }

    public Boolean getHalfDayCalculationEnabled() { return halfDayCalculationEnabled; }
    public void setHalfDayCalculationEnabled(Boolean v) { this.halfDayCalculationEnabled = v; }

    public Double getHalfDayMaxHours() { return halfDayMaxHours; }
    public void setHalfDayMaxHours(Double v) { this.halfDayMaxHours = v; }

    public String getAutoAbsentTime() { return autoAbsentTime; }
    public void setAutoAbsentTime(String v) { this.autoAbsentTime = v; }

    public Boolean getAutoAbsentEnabled() { return autoAbsentEnabled; }
    public void setAutoAbsentEnabled(Boolean v) { this.autoAbsentEnabled = v; }

    public Boolean getAutoOutEnabled() { return autoOutEnabled; }
    public void setAutoOutEnabled(Boolean v) { this.autoOutEnabled = v; }

    public String getAutoOutTime() { return autoOutTime; }
    public void setAutoOutTime(String v) { this.autoOutTime = v; }

    public Boolean getRegularizationEnabled() { return regularizationEnabled; }
    public void setRegularizationEnabled(Boolean v) { this.regularizationEnabled = v; }

    public Integer getRegularizationMaxBackdateDays() { return regularizationMaxBackdateDays; }
    public void setRegularizationMaxBackdateDays(Integer v) { this.regularizationMaxBackdateDays = v; }

    public Integer getRegularizationMonthlyCapPerEmployee() { return regularizationMonthlyCapPerEmployee; }
    public void setRegularizationMonthlyCapPerEmployee(Integer v) { this.regularizationMonthlyCapPerEmployee = v; }

    public Integer getRegularizationAutoApproveWindowMinutes() { return regularizationAutoApproveWindowMinutes; }
    public void setRegularizationAutoApproveWindowMinutes(Integer v) { this.regularizationAutoApproveWindowMinutes = v; }
}
