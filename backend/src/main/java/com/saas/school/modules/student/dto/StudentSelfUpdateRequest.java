package com.saas.school.modules.student.dto;

/**
 * Whitelist of fields a logged-in STUDENT is allowed to update on their own
 * profile. Any field NOT on this DTO (firstName, lastName, dateOfBirth,
 * admissionNumber, classId, sectionId, academicYearId, gender, etc.) cannot
 * be touched via the self-service endpoint by construction — the school
 * record stays under admin control.
 *
 * Used only by {@code PUT /api/v1/students/me/profile}. Admin updates still
 * go through {@link CreateStudentRequest} / {@link UpdateStudentRequest}.
 */
public class StudentSelfUpdateRequest {

    private String phone;
    private String email;
    private String bloodGroup;
    private CreateStudentRequest.AddressDto address;

    // Parent contact — student is allowed to update emergency contact info.
    private String parentName;
    private String parentPhone;
    private String parentEmail;

    public StudentSelfUpdateRequest() {}

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public CreateStudentRequest.AddressDto getAddress() { return address; }
    public void setAddress(CreateStudentRequest.AddressDto address) { this.address = address; }

    public String getParentName() { return parentName; }
    public void setParentName(String parentName) { this.parentName = parentName; }

    public String getParentPhone() { return parentPhone; }
    public void setParentPhone(String parentPhone) { this.parentPhone = parentPhone; }

    public String getParentEmail() { return parentEmail; }
    public void setParentEmail(String parentEmail) { this.parentEmail = parentEmail; }
}
