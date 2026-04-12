package com.saas.school.modules.attendance.dto;
import lombok.Builder; import lombok.Data;
@Data @Builder
public class AttendanceSummaryDto {
    private String studentId;
    private long totalDays, present, absent, late, halfDay;
    private double attendancePercentage;
}