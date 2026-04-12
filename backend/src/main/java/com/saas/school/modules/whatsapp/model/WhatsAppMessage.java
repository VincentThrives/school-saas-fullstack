package com.saas.school.modules.whatsapp.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "whatsapp_messages")
public class WhatsAppMessage {

    public enum RecipientType {
        CLASS, INDIVIDUAL
    }

    public enum ContentType {
        TEXT, IMAGE, DOCUMENT
    }

    public enum MessageStatus {
        QUEUED, PROCESSING, COMPLETED, PARTIALLY_FAILED, FAILED
    }

    public enum DeliveryStatus {
        PENDING, SENT, DELIVERED, FAILED
    }

    public static class RecipientDetail {
        private String parentId;
        private String parentName;
        private String phone;
        private String whatsappMessageId;
        private DeliveryStatus deliveryStatus;
        private String errorMessage;

        public RecipientDetail() {
        }

        public String getParentId() { return parentId; }
        public void setParentId(String parentId) { this.parentId = parentId; }

        public String getParentName() { return parentName; }
        public void setParentName(String parentName) { this.parentName = parentName; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getWhatsappMessageId() { return whatsappMessageId; }
        public void setWhatsappMessageId(String whatsappMessageId) { this.whatsappMessageId = whatsappMessageId; }

        public DeliveryStatus getDeliveryStatus() { return deliveryStatus; }
        public void setDeliveryStatus(DeliveryStatus deliveryStatus) { this.deliveryStatus = deliveryStatus; }

        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    }

    @Id
    private String messageId;

    private String sentBy;
    private String sentByName;
    private RecipientType recipientType;
    private String classId;
    private String className;
    private List<String> parentIds;
    private List<RecipientDetail> recipients;
    private String messageBody;
    private ContentType contentType;
    private String mediaUrl;
    private String mediaFileName;
    private String mediaMimeType;
    private int totalRecipients;
    private int successCount;
    private int failureCount;
    private MessageStatus status;

    @CreatedDate
    private Instant createdAt;

    private Instant completedAt;

    public WhatsAppMessage() {
    }

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getSentBy() { return sentBy; }
    public void setSentBy(String sentBy) { this.sentBy = sentBy; }

    public String getSentByName() { return sentByName; }
    public void setSentByName(String sentByName) { this.sentByName = sentByName; }

    public RecipientType getRecipientType() { return recipientType; }
    public void setRecipientType(RecipientType recipientType) { this.recipientType = recipientType; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public List<String> getParentIds() { return parentIds; }
    public void setParentIds(List<String> parentIds) { this.parentIds = parentIds; }

    public List<RecipientDetail> getRecipients() { return recipients; }
    public void setRecipients(List<RecipientDetail> recipients) { this.recipients = recipients; }

    public String getMessageBody() { return messageBody; }
    public void setMessageBody(String messageBody) { this.messageBody = messageBody; }

    public ContentType getContentType() { return contentType; }
    public void setContentType(ContentType contentType) { this.contentType = contentType; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public String getMediaFileName() { return mediaFileName; }
    public void setMediaFileName(String mediaFileName) { this.mediaFileName = mediaFileName; }

    public String getMediaMimeType() { return mediaMimeType; }
    public void setMediaMimeType(String mediaMimeType) { this.mediaMimeType = mediaMimeType; }

    public int getTotalRecipients() { return totalRecipients; }
    public void setTotalRecipients(int totalRecipients) { this.totalRecipients = totalRecipients; }

    public int getSuccessCount() { return successCount; }
    public void setSuccessCount(int successCount) { this.successCount = successCount; }

    public int getFailureCount() { return failureCount; }
    public void setFailureCount(int failureCount) { this.failureCount = failureCount; }

    public MessageStatus getStatus() { return status; }
    public void setStatus(MessageStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
