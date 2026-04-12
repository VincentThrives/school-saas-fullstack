package com.saas.school.modules.academicyear.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; 
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "academic_years")
public class AcademicYear {
    @Id private String academicYearId;
    private String label;
    private LocalDate startDate, endDate;
    private boolean isCurrent;
    private Status status;
    @CreatedDate private Instant createdAt;
    public enum Status { ACTIVE, ARCHIVED }
}