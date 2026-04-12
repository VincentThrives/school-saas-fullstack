package com.saas.school.modules.mcq.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "mcq_results")
@CompoundIndex(name="exam_student_unique", def="{'mcqExamId':1,'studentId':1}", unique=true)
public class McqResult {
    @Id private String resultId;
    private String mcqExamId, studentId;
    private List<Integer> answers;
    private int score, totalQuestions, correctCount;
    private double percentage;
    private boolean isSubmitted;
    private Instant startedAt, submittedAt;
    @CreatedDate private Instant createdAt;
}