package com.saas.school.modules.assignment.dto;

public class SubmitAssignmentRequest {

    private String textResponse;
    private String attachmentUrl;
    private String attachmentName;

    public SubmitAssignmentRequest() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getTextResponse() {
        return textResponse;
    }

    public void setTextResponse(String textResponse) {
        this.textResponse = textResponse;
    }

    public String getAttachmentUrl() {
        return attachmentUrl;
    }

    public void setAttachmentUrl(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }

    public String getAttachmentName() {
        return attachmentName;
    }

    public void setAttachmentName(String attachmentName) {
        this.attachmentName = attachmentName;
    }
}
