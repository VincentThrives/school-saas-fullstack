package com.saas.school.modules.settings.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "settings")
public class SchoolSettings {
    @Id private String settingsId;
    private String tenantId;

    // ID format patterns
    private String admissionNumberFormat;
    private String rollNumberFormat;
    private String employeeIdFormat;

    // Security
    private PasswordPolicy passwordPolicy;
    private int maxLoginAttempts;
    private int sessionTimeoutMinutes;

    // Attendance
    private int attendanceWindowHours;
    private int lateThresholdMinutes;
    private String schoolStartTime; // "HH:mm"
    private String schoolEndTime;   // "HH:mm"

    // Academic
    private int defaultPassingMarksPercent;
    private Integer percentageRoundOff;       // 0,1,2 decimals
    private Integer sessionStartMonth;        // 1..12
    private Integer sessionEndMonth;          // 1..12
    private List<GradingBand> gradingScale = new ArrayList<>();

    // Fees
    private int feeGracePeriodDays;
    private String currencyCode;              // e.g. INR, USD
    private String currencySymbol;            // e.g. ₹, $
    private String invoicePrefix;             // e.g. INV-
    private boolean partialPaymentAllowed;
    private Double lateFinePerDay;            // optional

    // Identity
    private SchoolProfile profile;

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

    public SchoolProfile getProfile() { return profile; }
    public void setProfile(SchoolProfile profile) { this.profile = profile; }

    public String getSchoolStartTime() { return schoolStartTime; }
    public void setSchoolStartTime(String schoolStartTime) { this.schoolStartTime = schoolStartTime; }
    public String getSchoolEndTime() { return schoolEndTime; }
    public void setSchoolEndTime(String schoolEndTime) { this.schoolEndTime = schoolEndTime; }

    public Integer getPercentageRoundOff() { return percentageRoundOff; }
    public void setPercentageRoundOff(Integer percentageRoundOff) { this.percentageRoundOff = percentageRoundOff; }
    public Integer getSessionStartMonth() { return sessionStartMonth; }
    public void setSessionStartMonth(Integer sessionStartMonth) { this.sessionStartMonth = sessionStartMonth; }
    public Integer getSessionEndMonth() { return sessionEndMonth; }
    public void setSessionEndMonth(Integer sessionEndMonth) { this.sessionEndMonth = sessionEndMonth; }
    public List<GradingBand> getGradingScale() { return gradingScale; }
    public void setGradingScale(List<GradingBand> gradingScale) { this.gradingScale = gradingScale; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }
    public String getCurrencySymbol() { return currencySymbol; }
    public void setCurrencySymbol(String currencySymbol) { this.currencySymbol = currencySymbol; }
    public String getInvoicePrefix() { return invoicePrefix; }
    public void setInvoicePrefix(String invoicePrefix) { this.invoicePrefix = invoicePrefix; }
    public boolean isPartialPaymentAllowed() { return partialPaymentAllowed; }
    public void setPartialPaymentAllowed(boolean partialPaymentAllowed) { this.partialPaymentAllowed = partialPaymentAllowed; }
    public Double getLateFinePerDay() { return lateFinePerDay; }
    public void setLateFinePerDay(Double lateFinePerDay) { this.lateFinePerDay = lateFinePerDay; }

    public static class GradingBand {
        private String grade;         // A+, A, B+, ...
        private Integer minPercent;   // inclusive
        public GradingBand() {}
        public GradingBand(String grade, Integer minPercent) { this.grade = grade; this.minPercent = minPercent; }
        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }
        public Integer getMinPercent() { return minPercent; }
        public void setMinPercent(Integer minPercent) { this.minPercent = minPercent; }
    }

    public static class SchoolProfile {
        private String displayName;
        private String tagline;
        private String logoUrl;
        private String contactEmail;
        private String contactPhone;
        private String website;
        private String principalName;
        private String boardAffiliation;
        private Integer establishedYear;
        private String addressLine1;
        private String addressLine2;
        private String city;
        private String state;
        private String country;
        private String zip;

        public SchoolProfile() {}

        public String getDisplayName() { return displayName; }
        public void setDisplayName(String displayName) { this.displayName = displayName; }
        public String getTagline() { return tagline; }
        public void setTagline(String tagline) { this.tagline = tagline; }
        public String getLogoUrl() { return logoUrl; }
        public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
        public String getContactEmail() { return contactEmail; }
        public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
        public String getContactPhone() { return contactPhone; }
        public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
        public String getWebsite() { return website; }
        public void setWebsite(String website) { this.website = website; }
        public String getPrincipalName() { return principalName; }
        public void setPrincipalName(String principalName) { this.principalName = principalName; }
        public String getBoardAffiliation() { return boardAffiliation; }
        public void setBoardAffiliation(String boardAffiliation) { this.boardAffiliation = boardAffiliation; }
        public Integer getEstablishedYear() { return establishedYear; }
        public void setEstablishedYear(Integer establishedYear) { this.establishedYear = establishedYear; }
        public String getAddressLine1() { return addressLine1; }
        public void setAddressLine1(String addressLine1) { this.addressLine1 = addressLine1; }
        public String getAddressLine2() { return addressLine2; }
        public void setAddressLine2(String addressLine2) { this.addressLine2 = addressLine2; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
        public String getZip() { return zip; }
        public void setZip(String zip) { this.zip = zip; }
    }

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
