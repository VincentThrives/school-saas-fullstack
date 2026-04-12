package com.saas.school.modules.event.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "events")
public class SchoolEvent {
    @Id private String eventId;
    private String title, description, createdBy;
    private EventType type;
    private LocalDate startDate, endDate;
    private boolean isHoliday, isRecurring;
    private RecurrencePattern recurrencePattern;
    private List<String> visibleTo;
    @CreatedDate private Instant createdAt;
    public enum EventType { CULTURAL, SPORTS, ACADEMIC, HOLIDAY, MEETING, OTHER }
    public enum RecurrencePattern { WEEKLY, MONTHLY, YEARLY }
}