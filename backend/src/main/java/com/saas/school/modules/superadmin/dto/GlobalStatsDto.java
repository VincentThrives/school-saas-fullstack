package com.saas.school.modules.superadmin.dto;

public class GlobalStatsDto {

    private long totalTenants;
    private long activeTenants;
    private long inactiveTenants;
    private long suspendedTenants;

    public GlobalStatsDto() {
    }

    public GlobalStatsDto(long totalTenants, long activeTenants, long inactiveTenants, long suspendedTenants) {
        this.totalTenants = totalTenants;
        this.activeTenants = activeTenants;
        this.inactiveTenants = inactiveTenants;
        this.suspendedTenants = suspendedTenants;
    }

    public long getTotalTenants() {
        return totalTenants;
    }

    public void setTotalTenants(long totalTenants) {
        this.totalTenants = totalTenants;
    }

    public long getActiveTenants() {
        return activeTenants;
    }

    public void setActiveTenants(long activeTenants) {
        this.activeTenants = activeTenants;
    }

    public long getInactiveTenants() {
        return inactiveTenants;
    }

    public void setInactiveTenants(long inactiveTenants) {
        this.inactiveTenants = inactiveTenants;
    }

    public long getSuspendedTenants() {
        return suspendedTenants;
    }

    public void setSuspendedTenants(long suspendedTenants) {
        this.suspendedTenants = suspendedTenants;
    }
}
