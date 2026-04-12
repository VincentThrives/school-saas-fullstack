package com.saas.school.modules.student.dto;
import lombok.Data;
@Data
public class UpdateStudentRequest {
    private String rollNumber, classId, sectionId, bloodGroup;
    private AddressDto address;
    @Data public static class AddressDto { private String street, city, state, zip; }
}