package com.saas.school.modules.dashboard.dto;
import lombok.Builder; import lombok.Data;
import java.util.Map;
@Data @Builder
public class DashboardDto {
    // School Admin / Principal
    private Long totalStudents, totalTeachers, totalUsers;
    private Double attendanceTodayPercent;
    private Long upcomingExamsCount;
    private Long unreadNotifications;
    // Super Admin
    private Long totalTenants, activeTenants;
    // Generic
    private Map<String, Object> extras;
}