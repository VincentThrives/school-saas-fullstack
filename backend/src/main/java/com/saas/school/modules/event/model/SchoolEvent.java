package com.saas.school.modules.event.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*;
import java.util.List;

@Document(collection = "events")
public class SchoolEvent {
    @Id private String eventId;
    private String title;
    private String description;
    private String createdBy;
    private EventType type;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean isHoliday;
    private boolean isRecurring;
    private RecurrencePattern recurrencePattern;
    private List<String> visibleTo;
    @CreatedDate private Instant createdAt;

    public enum EventType { CULTURAL, SPORTS, ACADEMIC, HOLIDAY, MEETING, OTHER }
    public enum RecurrencePattern { WEEKLY, MONTHLY, YEARLY }

    public SchoolEvent() {
    }

    public SchoolEvent(String eventId, String title, String description, String createdBy, EventType type,
                       LocalDate startDate, LocalDate endDate, boolean isHoliday, boolean isRecurring,
                       RecurrencePattern recurrencePattern, List<String> visibleTo, Instant createdAt) {
        this.eventId = eventId;
        this.title = title;
        this.description = description;
        this.createdBy = createdBy;
        this.type = type;
        this.startDate = startDate;
        this.endDate = endDate;
        this.isHoliday = isHoliday;
        this.isRecurring = isRecurring;
        this.recurrencePattern = recurrencePattern;
        this.visibleTo = visibleTo;
        this.createdAt = createdAt;
    }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public EventType getType() { return type; }
    public void setType(EventType type) { this.type = type; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public boolean isHoliday() { return isHoliday; }
    public void setHoliday(boolean isHoliday) { this.isHoliday = isHoliday; }

    public boolean isRecurring() { return isRecurring; }
    public void setRecurring(boolean isRecurring) { this.isRecurring = isRecurring; }

    public RecurrencePattern getRecurrencePattern() { return recurrencePattern; }
    public void setRecurrencePattern(RecurrencePattern recurrencePattern) { this.recurrencePattern = recurrencePattern; }

    public List<String> getVisibleTo() { return visibleTo; }
    public void setVisibleTo(List<String> visibleTo) { this.visibleTo = visibleTo; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
