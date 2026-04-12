package com.saas.school.modules.whatsapp.dto;

public class RecipientInfo {

    private String parentId;
    private String parentName;
    private String phone;

    public RecipientInfo() {
    }

    public RecipientInfo(String parentId, String parentName, String phone) {
        this.parentId = parentId;
        this.parentName = parentName;
        this.phone = phone;
    }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }

    public String getParentName() { return parentName; }
    public void setParentName(String parentName) { this.parentName = parentName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
