package com.saas.school.modules.mcq.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "mcq_questions")
public class McqQuestion {
    @Id private String questionId;
    private String subjectId, classId, createdBy;
    private String questionText;
    private List<String> options;
    private int correctOptionIndex;
    private Difficulty difficulty;
    private List<String> tags;
    @CreatedDate private Instant createdAt;
    public enum Difficulty { EASY, MEDIUM, HARD }
}