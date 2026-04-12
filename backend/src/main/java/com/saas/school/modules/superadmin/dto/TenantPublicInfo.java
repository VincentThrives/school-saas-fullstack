package com.saas.school.modules.superadmin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TenantPublicInfo {
    private String tenantId;
    private String schoolName;
    private String logoUrl;
    private String status;
}
