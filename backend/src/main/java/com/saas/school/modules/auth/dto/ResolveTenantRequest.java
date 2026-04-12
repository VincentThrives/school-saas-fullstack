package com.saas.school.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;

public class ResolveTenantRequest {

    @NotBlank
    private String schoolId;

    public ResolveTenantRequest() {
    }

    public String getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(String schoolId) {
        this.schoolId = schoolId;
    }
}
