package com.saas.school.modules.teacher.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

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
    private List<String> subjectIds;
    private List<String> classIds;
    private List<String> sectionIds;
    private boolean isClassTeacher;
    private String classTeacherOfClassId;
    private String classTeacherOfSectionId;
    private LocalDate joiningDate;

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

    public LocalDate getJoiningDate() {
        return joiningDate;
    }

    public void setJoiningDate(LocalDate joiningDate) {
        this.joiningDate = joiningDate;
    }

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
}
