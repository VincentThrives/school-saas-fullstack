package com.saas.school.modules.dashboard.dto;

import java.util.Map;

public class DashboardDto {

    // School Admin / Principal
    private Long totalStudents;
    private Long totalTeachers;
    private Long totalUsers;
    private Double attendanceTodayPercent;
    private Long totalClasses;
    private Long upcomingExamsCount;
    private Long unreadNotifications;
    // Super Admin
    private Long totalTenants;
    private Long activeTenants;
    // Generic
    private Map<String, Object> extras;

    public DashboardDto() {
    }

    public DashboardDto(Long totalStudents, Long totalTeachers, Long totalUsers,
                        Double attendanceTodayPercent, Long upcomingExamsCount, Long unreadNotifications,
                        Long totalTenants, Long activeTenants, Map<String, Object> extras) {
        this.totalStudents = totalStudents;
        this.totalTeachers = totalTeachers;
        this.totalUsers = totalUsers;
        this.attendanceTodayPercent = attendanceTodayPercent;
        this.upcomingExamsCount = upcomingExamsCount;
        this.unreadNotifications = unreadNotifications;
        this.totalTenants = totalTenants;
        this.activeTenants = activeTenants;
        this.extras = extras;
    }

    public Long getTotalStudents() {
        return totalStudents;
    }

    public void setTotalStudents(Long totalStudents) {
        this.totalStudents = totalStudents;
    }

    public Long getTotalTeachers() {
        return totalTeachers;
    }

    public void setTotalTeachers(Long totalTeachers) {
        this.totalTeachers = totalTeachers;
    }

    public Long getTotalUsers() {
        return totalUsers;
    }

    public void setTotalUsers(Long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public Double getAttendanceTodayPercent() {
        return attendanceTodayPercent;
    }

    public void setAttendanceTodayPercent(Double attendanceTodayPercent) {
        this.attendanceTodayPercent = attendanceTodayPercent;
    }

    public Long getTotalClasses() { return totalClasses; }
    public void setTotalClasses(Long totalClasses) { this.totalClasses = totalClasses; }

    public Long getUpcomingExamsCount() {
        return upcomingExamsCount;
    }

    public void setUpcomingExamsCount(Long upcomingExamsCount) {
        this.upcomingExamsCount = upcomingExamsCount;
    }

    public Long getUnreadNotifications() {
        return unreadNotifications;
    }

    public void setUnreadNotifications(Long unreadNotifications) {
        this.unreadNotifications = unreadNotifications;
    }

    public Long getTotalTenants() {
        return totalTenants;
    }

    public void setTotalTenants(Long totalTenants) {
        this.totalTenants = totalTenants;
    }

    public Long getActiveTenants() {
        return activeTenants;
    }

    public void setActiveTenants(Long activeTenants) {
        this.activeTenants = activeTenants;
    }

    public Map<String, Object> getExtras() {
        return extras;
    }

    public void setExtras(Map<String, Object> extras) {
        this.extras = extras;
    }
}
