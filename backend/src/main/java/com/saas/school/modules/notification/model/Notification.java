package com.saas.school.modules.notification.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "notifications")
public class Notification {
    @Id private String notificationId;
    private String title, body, createdBy;
    private NotificationType type;
    private Channel channel;
    private RecipientType recipientType;
    private String recipientRole, recipientClassId;
    private List<String> recipientIds, readBy;
    private Instant sentAt;
    @CreatedDate private Instant createdAt;
    public enum NotificationType { ANNOUNCEMENT, EXAM, ATTENDANCE, FEE, GENERAL, ALERT }
    public enum Channel { IN_APP, EMAIL, BOTH }
    public enum RecipientType { ALL, ROLE, CLASS, INDIVIDUAL }
}