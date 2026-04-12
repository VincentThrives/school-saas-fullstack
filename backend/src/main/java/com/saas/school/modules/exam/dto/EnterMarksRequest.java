package com.saas.school.modules.exam.dto;
import jakarta.validation.constraints.NotBlank; import jakarta.validation.constraints.NotNull;
import lombok.Data; import java.util.List;
@Data
public class EnterMarksRequest {
    @NotBlank private String examId;
    @NotNull private List<MarkEntry> marks;
    @Data public static class MarkEntry {
        private String studentId;
        private Double marksObtained;
        private String remarks;
    }
}