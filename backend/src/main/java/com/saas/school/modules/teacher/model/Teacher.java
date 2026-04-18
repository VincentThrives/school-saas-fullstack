package com.saas.school.modules.teacher.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "teachers")
public class Teacher {
    @Id
    private String teacherId;
    private String userId;
    private String firstName;
    private String lastName;
    private String phone;
    private String email;

    @Indexed(unique = true)
    private String employeeId;
    private String qualification;
    private String specialization;
    private String employeeRole;
    private List<ClassSubjectAssignment> classSubjectAssignments;
    private List<String> subjectIds;
    private List<String> classIds;
    private List<String> sectionIds;
    @JsonProperty("classTeacher")
    @JsonAlias({"isClassTeacher", "classTeacher"})
    private boolean isClassTeacher;
    private String classTeacherOfClassId;
    private String classTeacherOfSectionId;
    private LocalDate dateOfBirth;
    private LocalDate joiningDate;
    private Address address;

    @CreatedDate
    private Instant createdAt;
    private Instant deletedAt;

    // ── Constructors ──────────────────────────────────────────────

    public Teacher() {
    }

    public Teacher(String teacherId, String userId, String employeeId, String qualification,
                   String specialization, List<String> subjectIds, List<String> classIds,
                   List<String> sectionIds, boolean isClassTeacher, String classTeacherOfClassId,
                   String classTeacherOfSectionId, LocalDate joiningDate, Instant createdAt,
                   Instant deletedAt) {
        this.teacherId = teacherId;
        this.userId = userId;
        this.employeeId = employeeId;
        this.qualification = qualification;
        this.specialization = specialization;
        this.subjectIds = subjectIds;
        this.classIds = classIds;
        this.sectionIds = sectionIds;
        this.isClassTeacher = isClassTeacher;
        this.classTeacherOfClassId = classTeacherOfClassId;
        this.classTeacherOfSectionId = classTeacherOfSectionId;
        this.joiningDate = joiningDate;
        this.createdAt = createdAt;
        this.deletedAt = deletedAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(String teacherId) {
        this.teacherId = teacherId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(String employeeId) {
        this.employeeId = employeeId;
    }

    public String getQualification() {
        return qualification;
    }

    public void setQualification(String qualification) {
        this.qualification = qualification;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public List<String> getSubjectIds() {
        return subjectIds;
    }

    public void setSubjectIds(List<String> subjectIds) {
        this.subjectIds = subjectIds;
    }

    public List<String> getClassIds() {
        return classIds;
    }

    public void setClassIds(List<String> classIds) {
        this.classIds = classIds;
    }

    public List<String> getSectionIds() {
        return sectionIds;
    }

    public void setSectionIds(List<String> sectionIds) {
        this.sectionIds = sectionIds;
    }

    public boolean isClassTeacher() {
        return isClassTeacher;
    }

    public void setClassTeacher(boolean classTeacher) {
        isClassTeacher = classTeacher;
    }

    public String getClassTeacherOfClassId() {
        return classTeacherOfClassId;
    }

    public void setClassTeacherOfClassId(String classTeacherOfClassId) {
        this.classTeacherOfClassId = classTeacherOfClassId;
    }

    public String getClassTeacherOfSectionId() {
        return classTeacherOfSectionId;
    }

    public void setClassTeacherOfSectionId(String classTeacherOfSectionId) {
        this.classTeacherOfSectionId = classTeacherOfSectionId;
    }

    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public LocalDate getJoiningDate() {
        return joiningDate;
    }

    public void setJoiningDate(LocalDate joiningDate) {
        this.joiningDate = joiningDate;
    }

    public Address getAddress() { return address; }
    public void setAddress(Address address) { this.address = address; }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public String getEmployeeRole() { return employeeRole; }
    public void setEmployeeRole(String employeeRole) { this.employeeRole = employeeRole; }

    public List<ClassSubjectAssignment> getClassSubjectAssignments() { return classSubjectAssignments; }
    public void setClassSubjectAssignments(List<ClassSubjectAssignment> classSubjectAssignments) {
        this.classSubjectAssignments = classSubjectAssignments;
    }

    /** Sync classIds and subjectIds from classSubjectAssignments for backward compatibility */
    public void syncFromAssignments() {
        if (classSubjectAssignments == null || classSubjectAssignments.isEmpty()) return;
        java.util.Set<String> cIds = new java.util.LinkedHashSet<>();
        java.util.Set<String> sIds = new java.util.LinkedHashSet<>();
        java.util.Set<String> secIds = new java.util.LinkedHashSet<>();
        for (ClassSubjectAssignment a : classSubjectAssignments) {
            if (a.getClassId() != null) cIds.add(a.getClassId());
            if (a.getSubjectId() != null) sIds.add(a.getSubjectId());
            if (a.getSectionId() != null) secIds.add(a.getSectionId());
        }
        this.classIds = new java.util.ArrayList<>(cIds);
        this.subjectIds = new java.util.ArrayList<>(sIds);
        this.sectionIds = new java.util.ArrayList<>(secIds);
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum EmployeeRole {
        TEACHER, ACCOUNTANT, CLERK, PRINCIPAL, HEAD_MISTRESS, LAB_ASSISTANT, NON_TEACHING
    }

    public static class ClassSubjectAssignment {
        private String classId;
        private String sectionId;
        private String subjectId;

        public ClassSubjectAssignment() {}

        public ClassSubjectAssignment(String classId, String sectionId, String subjectId) {
            this.classId = classId;
            this.sectionId = sectionId;
            this.subjectId = subjectId;
        }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
    }

    public static class Address {
        private String street;
        private String city;
        private String state;
        private String country;
        private String zip;

        public Address() {}

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
