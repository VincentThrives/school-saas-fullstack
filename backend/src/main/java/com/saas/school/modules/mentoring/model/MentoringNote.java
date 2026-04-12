package com.saas.school.modules.mentoring.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "mentoring_notes")
public class MentoringNote {
    @Id private String noteId;
    private String studentId, teacherId, note;
    private Category category;
    private boolean isFlagged;
    @CreatedDate private Instant createdAt;
    public enum Category { ACADEMIC, BEHAVIORAL, ATTENDANCE, HEALTH, OTHER }
}