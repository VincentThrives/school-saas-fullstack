package com.saas.school.modules.mcq.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "mcq_exams")
public class McqExam {
    @Id private String mcqExamId;
    private String title, classId, sectionId, subjectId, academicYearId, createdBy;
    private List<String> questionIds;
    private Instant startTime, endTime;
    private int durationMinutes;
    private boolean shuffleOptions, showResultImmediately, allowRetake;
    private ExamStatus status;
    @CreatedDate private Instant createdAt;
    public enum ExamStatus { DRAFT, PUBLISHED, ONGOING, COMPLETED }
}