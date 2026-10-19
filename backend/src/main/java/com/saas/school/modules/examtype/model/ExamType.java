package com.saas.school.modules.examtype.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Catalog entry for one assessment TYPE a school uses — FA (Formative),
 * SA (Summative), OTHER, or anything a school adds like "Monthly Test" /
 * "Portfolio" / "Lab Practical". Each {@link com.saas.school.modules.examscheme.model.Scheme.Slot}
 * references one of these entries by {@link #id} via its {@code typeId}
 * field; when a slot is rolled out, the generated {@code Exam} doc stamps
 * {@link #name} onto {@code exam.examType}.
 *
 * <p>School Admins manage this list from the "Exam Type" tab on the Exam
 * Types page. The three defaults (FA / SA / OTHER) are seeded on first
 * access so legacy data and the slot editor's colour map have something
 * to anchor to.
 */
@Document(collection = "exam_types")
public class ExamType {

    @Id
    private String id;

    private String name;              // Display label — "FA", "SA", "Monthly Test", ...
    /**
     * Stable short key used by other collections to reference a type across
     * renames. Defaults to a slug of {@link #name} on create. The seeded
     * defaults use keys {@code "FA"}, {@code "SA"}, {@code "OTHER"} so the
     * frontend's colour map keeps working regardless of how an admin
     * renames the labels.
     */
    private String key;
    /**
     * Optional CSS colour (hex) used by the editor's slot pill and the
     * scheme card to tint entries belonging to this type. Falls back to a
     * neutral grey when null.
     */
    private String color;
    private int displayOrder;
    private String description;
    private Status status;

    @CreatedDate  private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;

    public ExamType() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }

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
