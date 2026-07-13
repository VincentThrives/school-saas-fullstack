package com.saas.school.modules.notification.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "notifications")
@CompoundIndexes({
    // Feeds the Homework page query (?type=HOMEWORK&date=<day>) — the
    // filtered inbox call rides this index directly. Keeps response
    // times flat as a school accumulates thousands of notifications
    // over the year.
    @CompoundIndex(name = "type_sentAt", def = "{'type':1,'sentAt':-1}")
})
public class Notification {
    @Id private String notificationId;
    private String title;
    private String body;
    private String createdBy;
    private NotificationType type;
    private Channel channel;
    private RecipientType recipientType;
    private String recipientRole;
    private String recipientClassId;
    /**
     * Which section of {@link #recipientClassId} this notification
     * targets. Optional — null means "the whole class, all sections".
     * Currently only meaningful when {@link #recipientType} is CLASS,
     * and is used by the Homework completion roster to enumerate the
     * right set of students. Frontend already sends it in the
     * compose payload; older docs saved before this field existed
     * deserialise as null and fall back to whole-class scope.
     */
    private String recipientSectionId;
    private List<String> recipientIds;
    /**
     * Homework-only backlink: when this notification is a REMINDER
     * ("Save & Notify undone"), this points to the original homework's
     * notificationId. Lets us (a) delete previous reminders for the
     * same homework before sending a new one so the student's inbox
     * doesn't stack up "Homework not done" rows, and (b) hide reminders
     * from the teacher's own Homework list so they only see originals.
     * Null on every other notification.
     */
    private String remindsHomeworkId;
    private List<String> readBy;
    private Instant sentAt;
    @CreatedDate private Instant createdAt;

    public enum NotificationType { ANNOUNCEMENT, EXAM, ATTENDANCE, FEE, GENERAL, ALERT, HOMEWORK }
    public enum Channel { IN_APP, EMAIL, BOTH }
    public enum RecipientType { ALL, ROLE, CLASS, INDIVIDUAL }

    public Notification() {
    }

    public Notification(String notificationId, String title, String body, String createdBy, NotificationType type,
                        Channel channel, RecipientType recipientType, String recipientRole, String recipientClassId,
                        List<String> recipientIds, List<String> readBy, Instant sentAt, Instant createdAt) {
        this.notificationId = notificationId;
        this.title = title;
        this.body = body;
        this.createdBy = createdBy;
        this.type = type;
        this.channel = channel;
        this.recipientType = recipientType;
        this.recipientRole = recipientRole;
        this.recipientClassId = recipientClassId;
        this.recipientIds = recipientIds;
        this.readBy = readBy;
        this.sentAt = sentAt;
        this.createdAt = createdAt;
    }

    public String getNotificationId() { return notificationId; }
    public void setNotificationId(String notificationId) { this.notificationId = notificationId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }

    public Channel getChannel() { return channel; }
    public void setChannel(Channel channel) { this.channel = channel; }

    public RecipientType getRecipientType() { return recipientType; }
    public void setRecipientType(RecipientType recipientType) { this.recipientType = recipientType; }

    public String getRecipientRole() { return recipientRole; }
    public void setRecipientRole(String recipientRole) { this.recipientRole = recipientRole; }

    public String getRecipientClassId() { return recipientClassId; }
    public void setRecipientClassId(String recipientClassId) { this.recipientClassId = recipientClassId; }

    public String getRecipientSectionId() { return recipientSectionId; }
    public void setRecipientSectionId(String recipientSectionId) { this.recipientSectionId = recipientSectionId; }

    public List<String> getRecipientIds() { return recipientIds; }
    public void setRecipientIds(List<String> recipientIds) { this.recipientIds = recipientIds; }

    public String getRemindsHomeworkId() { return remindsHomeworkId; }
    public void setRemindsHomeworkId(String remindsHomeworkId) { this.remindsHomeworkId = remindsHomeworkId; }

    public List<String> getReadBy() { return readBy; }
    public void setReadBy(List<String> readBy) { this.readBy = readBy; }

    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
