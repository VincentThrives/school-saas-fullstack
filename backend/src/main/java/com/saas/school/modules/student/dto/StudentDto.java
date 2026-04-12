package com.saas.school.modules.student.dto;
import com.saas.school.modules.student.model.Student.Gender;
import lombok.Builder; import lombok.Data;
import java.time.Instant; import java.time.LocalDate; import java.util.List;
@Data @Builder
public class StudentDto {
    private String studentId, userId, admissionNumber, rollNumber;
    private String classId, sectionId, academicYearId;
    private List<String> parentIds;
    private LocalDate dateOfBirth;
    private Gender gender;
    private String bloodGroup;
    private Instant createdAt;
}