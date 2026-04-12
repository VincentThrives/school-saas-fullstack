package com.saas.school.modules.superadmin.dto;

public class TenantPublicInfo {

    private String tenantId;
    private String schoolName;
    private String logoUrl;
    private String status;

    public TenantPublicInfo() {
    }

    public TenantPublicInfo(String tenantId, String schoolName, String logoUrl, String status) {
        this.tenantId = tenantId;
        this.schoolName = schoolName;
        this.logoUrl = logoUrl;
        this.status = status;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getSchoolName() {
        return schoolName;
    }

    public void setSchoolName(String schoolName) {
        this.schoolName = schoolName;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
