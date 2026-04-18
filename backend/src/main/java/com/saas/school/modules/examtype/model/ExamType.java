package com.saas.school.modules.examtype.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Catalog of exam types a school runs (Unit Test, Sem 1, Final, …).
 * School Admins manage this list; every exam-type dropdown in the app pulls from it.
 */
@Document(collection = "exam_types")
public class ExamType {

    @Id
    private String id;

    private String name;              // e.g. "Sem 1" — unique per tenant (case-insensitive)
    private int displayOrder;         // used to sort dropdowns
    private Integer defaultMaxMarks;  // optional — pre-fills Exam form
    private String description;       // optional — tooltip text
    private Status status;

    @CreatedDate  private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    public ExamType() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }

    public Integer getDefaultMaxMarks() { return defaultMaxMarks; }
    public void setDefaultMaxMarks(Integer defaultMaxMarks) { this.defaultMaxMarks = defaultMaxMarks; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public enum Status { ACTIVE, ARCHIVED }
}
