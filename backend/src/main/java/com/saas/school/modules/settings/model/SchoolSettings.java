package com.saas.school.modules.settings.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "settings")
public class SchoolSettings {
    @Id private String settingsId;
    private String tenantId;
    private String admissionNumberFormat;
    private String rollNumberFormat;
    private String employeeIdFormat;
    private PasswordPolicy passwordPolicy;
    private int attendanceWindowHours;
    private int lateThresholdMinutes;
    private int defaultPassingMarksPercent;
    private int feeGracePeriodDays;
    private int maxLoginAttempts;
    private int sessionTimeoutMinutes;

    public SchoolSettings() {
    }

    public SchoolSettings(String settingsId, String tenantId, String admissionNumberFormat, String rollNumberFormat,
                          String employeeIdFormat, PasswordPolicy passwordPolicy, int attendanceWindowHours,
                          int lateThresholdMinutes, int defaultPassingMarksPercent, int feeGracePeriodDays,
                          int maxLoginAttempts, int sessionTimeoutMinutes) {
        this.settingsId = settingsId;
        this.tenantId = tenantId;
        this.admissionNumberFormat = admissionNumberFormat;
        this.rollNumberFormat = rollNumberFormat;
        this.employeeIdFormat = employeeIdFormat;
        this.passwordPolicy = passwordPolicy;
        this.attendanceWindowHours = attendanceWindowHours;
        this.lateThresholdMinutes = lateThresholdMinutes;
        this.defaultPassingMarksPercent = defaultPassingMarksPercent;
        this.feeGracePeriodDays = feeGracePeriodDays;
        this.maxLoginAttempts = maxLoginAttempts;
        this.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }

    public String getSettingsId() { return settingsId; }
    public void setSettingsId(String settingsId) { this.settingsId = settingsId; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getAdmissionNumberFormat() { return admissionNumberFormat; }
    public void setAdmissionNumberFormat(String admissionNumberFormat) { this.admissionNumberFormat = admissionNumberFormat; }

    public String getRollNumberFormat() { return rollNumberFormat; }
    public void setRollNumberFormat(String rollNumberFormat) { this.rollNumberFormat = rollNumberFormat; }

    public String getEmployeeIdFormat() { return employeeIdFormat; }
    public void setEmployeeIdFormat(String employeeIdFormat) { this.employeeIdFormat = employeeIdFormat; }

    public PasswordPolicy getPasswordPolicy() { return passwordPolicy; }
    public void setPasswordPolicy(PasswordPolicy passwordPolicy) { this.passwordPolicy = passwordPolicy; }

    public int getAttendanceWindowHours() { return attendanceWindowHours; }
    public void setAttendanceWindowHours(int attendanceWindowHours) { this.attendanceWindowHours = attendanceWindowHours; }

    public int getLateThresholdMinutes() { return lateThresholdMinutes; }
    public void setLateThresholdMinutes(int lateThresholdMinutes) { this.lateThresholdMinutes = lateThresholdMinutes; }

    public int getDefaultPassingMarksPercent() { return defaultPassingMarksPercent; }
    public void setDefaultPassingMarksPercent(int defaultPassingMarksPercent) { this.defaultPassingMarksPercent = defaultPassingMarksPercent; }

    public int getFeeGracePeriodDays() { return feeGracePeriodDays; }
    public void setFeeGracePeriodDays(int feeGracePeriodDays) { this.feeGracePeriodDays = feeGracePeriodDays; }

    public int getMaxLoginAttempts() { return maxLoginAttempts; }
    public void setMaxLoginAttempts(int maxLoginAttempts) { this.maxLoginAttempts = maxLoginAttempts; }

    public int getSessionTimeoutMinutes() { return sessionTimeoutMinutes; }
    public void setSessionTimeoutMinutes(int sessionTimeoutMinutes) { this.sessionTimeoutMinutes = sessionTimeoutMinutes; }

    public static class PasswordPolicy {
        private int minLength;
        private boolean requireUppercase;
        private boolean requireSpecialChar;
        private int expiryDays;

        public PasswordPolicy() {
        }

        public PasswordPolicy(int minLength, boolean requireUppercase, boolean requireSpecialChar, int expiryDays) {
            this.minLength = minLength;
            this.requireUppercase = requireUppercase;
            this.requireSpecialChar = requireSpecialChar;
            this.expiryDays = expiryDays;
        }

        public int getMinLength() { return minLength; }
        public void setMinLength(int minLength) { this.minLength = minLength; }

        public boolean isRequireUppercase() { return requireUppercase; }
        public void setRequireUppercase(boolean requireUppercase) { this.requireUppercase = requireUppercase; }

        public boolean isRequireSpecialChar() { return requireSpecialChar; }
        public void setRequireSpecialChar(boolean requireSpecialChar) { this.requireSpecialChar = requireSpecialChar; }

        public int getExpiryDays() { return expiryDays; }
        public void setExpiryDays(int expiryDays) { this.expiryDays = expiryDays; }
    }
}
