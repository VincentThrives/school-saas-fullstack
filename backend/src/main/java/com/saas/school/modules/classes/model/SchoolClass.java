package com.saas.school.modules.classes.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "classes")
public class SchoolClass {
    @Id private String classId;
    private String name, academicYearId;
    private List<Section> sections;
    @CreatedDate private Instant createdAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Section {
        private String sectionId, name, classTeacherId;
        private int capacity;
    }
}