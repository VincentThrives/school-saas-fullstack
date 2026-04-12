package com.saas.school.modules.exam.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "exams")
public class Exam {
    @Id private String examId;
    private String name, classId, sectionId, subjectId, academicYearId;
    private int maxMarks, passingMarks;
    private LocalDate examDate;
    private ExamStatus status;
    private boolean marksLocked;
    @CreatedDate private Instant createdAt;
    public enum ExamStatus { SCHEDULED, ONGOING, COMPLETED, CANCELLED }
}