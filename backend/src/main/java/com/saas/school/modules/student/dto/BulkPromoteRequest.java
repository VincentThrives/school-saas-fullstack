package com.saas.school.modules.student.dto;
import jakarta.validation.constraints.NotBlank; import lombok.Data; import java.util.List;
@Data
public class BulkPromoteRequest {
    @NotBlank private String fromClassId, fromSectionId;
    @NotBlank private String toClassId, toSectionId, toAcademicYearId;
    private List<String> excludedStudentIds;
}