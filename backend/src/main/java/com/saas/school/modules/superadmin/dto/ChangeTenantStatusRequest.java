package com.saas.school.modules.superadmin.dto;

import com.saas.school.modules.tenant.model.Tenant.TenantStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChangeTenantStatusRequest {
    @NotNull private TenantStatus status;
    private String reason;
}
