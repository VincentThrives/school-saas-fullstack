package com.saas.school.modules.fee.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; 
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "fee_structures")
public class FeeStructure {
    @Id private String feeStructureId;
    private String academicYearId, classId;
    private FeeType feeType;
    private double amount;
    private LocalDate dueDate;
    private String description;
    @CreatedDate private Instant createdAt;
    public enum FeeType { TUITION, EXAM, LABORATORY, SPORTS, TRANSPORT, LIBRARY, OTHER }
}