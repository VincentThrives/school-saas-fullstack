package com.saas.school.modules.settings.model;
import lombok.*; import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
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

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PasswordPolicy {
        private int minLength;
        private boolean requireUppercase;
        private boolean requireSpecialChar;
        private int expiryDays;
    }
}