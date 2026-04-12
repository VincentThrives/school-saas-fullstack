package com.saas.school.modules.student.dto;

import com.saas.school.modules.student.model.Student.Gender;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public class StudentDto {

    private String studentId;
    private String userId;
    private String admissionNumber;
    private String rollNumber;
    private String classId;
    private String sectionId;
    private String academicYearId;
    private List<String> parentIds;
    private LocalDate dateOfBirth;
    private Gender gender;
    private String bloodGroup;
    private Instant createdAt;

    public StudentDto() {
    }

    public StudentDto(String studentId, String userId, String admissionNumber, String rollNumber,
                      String classId, String sectionId, String academicYearId, List<String> parentIds,
                      LocalDate dateOfBirth, Gender gender, String bloodGroup, Instant createdAt) {
        this.studentId = studentId;
        this.userId = userId;
        this.admissionNumber = admissionNumber;
        this.rollNumber = rollNumber;
        this.classId = classId;
        this.sectionId = sectionId;
        this.academicYearId = academicYearId;
        this.parentIds = parentIds;
        this.dateOfBirth = dateOfBirth;
        this.gender = gender;
        this.bloodGroup = bloodGroup;
        this.createdAt = createdAt;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getAdmissionNumber() {
        return admissionNumber;
    }

    public void setAdmissionNumber(String admissionNumber) {
        this.admissionNumber = admissionNumber;
    }

    public String getRollNumber() {
        return rollNumber;
    }

    public void setRollNumber(String rollNumber) {
        this.rollNumber = rollNumber;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getSectionId() {
        return sectionId;
    }

    public void setSectionId(String sectionId) {
        this.sectionId = sectionId;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public List<String> getParentIds() {
        return parentIds;
    }

    public void setParentIds(List<String> parentIds) {
        this.parentIds = parentIds;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public Gender getGender() {
        return gender;
    }

    public void setGender(Gender gender) {
        this.gender = gender;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public void setBloodGroup(String bloodGroup) {
        this.bloodGroup = bloodGroup;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
