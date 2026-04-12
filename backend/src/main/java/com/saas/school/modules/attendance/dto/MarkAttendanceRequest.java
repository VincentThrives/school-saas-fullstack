package com.saas.school.modules.attendance.dto;
import com.saas.school.modules.attendance.model.Attendance.Status;
import jakarta.validation.constraints.NotBlank; import jakarta.validation.constraints.NotNull;
import lombok.Data; import java.time.LocalDate; import java.util.List;
@Data
public class MarkAttendanceRequest {
    @NotBlank private String classId, sectionId, academicYearId;
    @NotNull private LocalDate date;
    @NotNull private List<AttendanceEntry> entries;
    @Data public static class AttendanceEntry {
        private String studentId;
        private Status status;
        private String remarks;
    }
}