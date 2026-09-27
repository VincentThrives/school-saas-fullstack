package com.saas.school.modules.superadmin.dto;

/**
 * Minimal tenant profile returned by the school-id lookup and the
 * post-login "who is my school?" endpoint. Includes the header details
 * every printable page (fee receipt, hall ticket) needs so the UI
 * doesn't have to make a second call for the school's address / phone.
 */
public class TenantPublicInfo {

    private String tenantId;
    private String schoolName;
    private String logoUrl;
    private String status;
    /** Comma-joined "street, city, state zip" — pre-formatted for
     *  single-line rendering under the school name on receipts. Null
     *  when the tenant hasn't filled its address yet. */
    private String address;
    private String contactPhone;
    private String contactEmail;

    public TenantPublicInfo() {
    }

    public TenantPublicInfo(String tenantId, String schoolName, String logoUrl, String status) {
        this.tenantId = tenantId;
        this.schoolName = schoolName;
        this.logoUrl = logoUrl;
        this.status = status;
    }

    public TenantPublicInfo(String tenantId, String schoolName, String logoUrl, String status,
                            String address, String contactPhone, String contactEmail) {
        this.tenantId = tenantId;
        this.schoolName = schoolName;
        this.logoUrl = logoUrl;
        this.status = status;
        this.address = address;
        this.contactPhone = contactPhone;
        this.contactEmail = contactEmail;
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

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
}
