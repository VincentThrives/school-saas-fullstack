package com.saas.school.modules.superadmin.dto;

import com.saas.school.modules.tenant.model.Tenant.TenantStatus;
import jakarta.validation.constraints.NotNull;

public class ChangeTenantStatusRequest {

    @NotNull
    private TenantStatus status;

    private String reason;

    public ChangeTenantStatusRequest() {
    }

    public TenantStatus getStatus() {
        return status;
    }

    public void setStatus(TenantStatus status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
