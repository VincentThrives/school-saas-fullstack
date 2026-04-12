package com.saas.school.modules.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public class SendWhatsAppRequest {

    private String recipientType;
    private String classId;
    private List<String> parentIds;

    @NotBlank
    private String messageBody;

    private String mediaUrl;
    private String mediaFileName;
    private String mediaMimeType;

    public SendWhatsAppRequest() {
    }

    public String getRecipientType() { return recipientType; }
    public void setRecipientType(String recipientType) { this.recipientType = recipientType; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public List<String> getParentIds() { return parentIds; }
    public void setParentIds(List<String> parentIds) { this.parentIds = parentIds; }

    public String getMessageBody() { return messageBody; }
    public void setMessageBody(String messageBody) { this.messageBody = messageBody; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public String getMediaFileName() { return mediaFileName; }
    public void setMediaFileName(String mediaFileName) { this.mediaFileName = mediaFileName; }

    public String getMediaMimeType() { return mediaMimeType; }
    public void setMediaMimeType(String mediaMimeType) { this.mediaMimeType = mediaMimeType; }
}
