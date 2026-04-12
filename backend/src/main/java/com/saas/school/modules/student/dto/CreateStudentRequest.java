package com.saas.school.modules.student.dto;
import com.saas.school.modules.student.model.Student.Gender;
import jakarta.validation.constraints.NotBlank; import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate; import java.util.List;
@Data
public class CreateStudentRequest {
    @NotBlank private String admissionNumber;
    private String rollNumber, userId, classId, sectionId, academicYearId;
    private List<String> parentIds;
    @NotNull private LocalDate dateOfBirth;
    private Gender gender;
    private String bloodGroup;
    private AddressDto address;
    @Data public static class AddressDto { private String street, city, state, zip; }
}