package com.saas.school.modules.superadmin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GlobalStatsDto {
    private long totalTenants;
    private long activeTenants;
    private long inactiveTenants;
    private long suspendedTenants;
}
