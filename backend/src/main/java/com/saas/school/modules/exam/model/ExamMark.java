package com.saas.school.modules.exam.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "exam_marks")
@CompoundIndexes({@CompoundIndex(name="exam_student", def="{'examId':1,'studentId':1}", unique=true)})
public class ExamMark {
    @Id private String markId;
    private String examId, studentId, teacherId;
    private Double marksObtained;
    private String grade, remarks;
    private boolean isPassed;
    @CreatedDate private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;
}