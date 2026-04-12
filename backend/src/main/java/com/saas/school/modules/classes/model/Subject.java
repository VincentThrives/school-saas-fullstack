package com.saas.school.modules.classes.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "subjects")
public class Subject {
    @Id private String subjectId;
    private String name, code, classId, academicYearId;
    private SubjectType type;
    private List<TeacherAssignment> teacherAssignments;
    @CreatedDate private Instant createdAt;
    public enum SubjectType { THEORY, PRACTICAL, ELECTIVE }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TeacherAssignment {
        private String teacherId, sectionId;
    }
}