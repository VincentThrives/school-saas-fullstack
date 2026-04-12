package com.saas.school.modules.teacher.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "teachers")
public class Teacher {
    @Id private String teacherId;
    private String userId;
    @Indexed(unique=true) private String employeeId;
    private String qualification, specialization;
    private List<String> subjectIds, classIds, sectionIds;
    private boolean isClassTeacher;
    private String classTeacherOfClassId, classTeacherOfSectionId;
    private LocalDate joiningDate;
    @CreatedDate private Instant createdAt;
    private Instant deletedAt;
}