package com.saas.school.modules.teacher.dto;

/**
 * Whitelist of fields a logged-in TEACHER / PRINCIPAL is allowed to update
 * on their own profile. Any field NOT on this DTO (firstName, lastName,
 * dateOfBirth, employeeId, employeeRole, joiningDate, classSubjectAssignments,
 * classTeacher flags) cannot be touched by self-service — those stay
 * admin-controlled by the school.
 *
 * Used only by {@code PUT /api/v1/employees/me/profile}. Admin updates still
 * go through the existing {@code PUT /employees/{id}}.
 */
public class EmployeeSelfUpdateRequest {

    private String phone;
    private String email;
    private String qualification;
    private String specialization;
    private AddressDto address;

    public EmployeeSelfUpdateRequest() {}

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getQualification() { return qualification; }
    public void setQualification(String qualification) { this.qualification = qualification; }

    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    public AddressDto getAddress() { return address; }
    public void setAddress(AddressDto address) { this.address = address; }

    /** Flat address shape that mirrors {@link com.saas.school.modules.teacher.model.Teacher.Address}. */
    public static class AddressDto {
        private String street;
        private String city;
        private String state;
        private String country;
        private String zip;

        public AddressDto() {}

        public String getStreet() { return street; }
        public void setStreet(String street) { this.street = street; }
        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }
        public String getState() { return state; }
        public void setState(String state) { this.state = state; }
        public String getCountry() { return country; }
        public void setCountry(String country) { this.country = country; }
        public String getZip() { return zip; }
        public void setZip(String zip) { this.zip = zip; }
    }
}
