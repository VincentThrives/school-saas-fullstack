package com.saas.school.modules.student.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Document(collection = "students")
public class Student {
    @Id
    private String studentId;
    private String userId;
    private String firstName;
    private String lastName;
    private String phone;
    private String email;

    @Indexed(unique = true)
    private String admissionNumber;
    private String rollNumber;
    private String classId;
    private String sectionId;
    private String academicYearId;
    private List<String> parentIds;
    private LocalDate dateOfBirth;
    private Gender gender;
    private String bloodGroup;
    private Address address;
    private List<AcademicHistory> academicHistory;
    private List<DocumentRef> documents;

    @CreatedDate
    private Instant createdAt;
    private Instant deletedAt;

    // ── Constructors ──────────────────────────────────────────────

    public Student() {
    }

    public Student(String studentId, String userId, String admissionNumber, String rollNumber,
                   String classId, String sectionId, String academicYearId, List<String> parentIds,
                   LocalDate dateOfBirth, Gender gender, String bloodGroup, Address address,
                   List<AcademicHistory> academicHistory, List<DocumentRef> documents,
                   Instant createdAt, Instant deletedAt) {
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
        this.address = address;
        this.academicHistory = academicHistory;
        this.documents = documents;
        this.createdAt = createdAt;
        this.deletedAt = deletedAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

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

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

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

    public Address getAddress() {
        return address;
    }

    public void setAddress(Address address) {
        this.address = address;
    }

    public List<AcademicHistory> getAcademicHistory() {
        return academicHistory;
    }

    public void setAcademicHistory(List<AcademicHistory> academicHistory) {
        this.academicHistory = academicHistory;
    }

    public List<DocumentRef> getDocuments() {
        return documents;
    }

    public void setDocuments(List<DocumentRef> documents) {
        this.documents = documents;
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

    // ── Nested types ──────────────────────────────────────────────

    public enum Gender { MALE, FEMALE, OTHER }

    public static class Address {
        private String street;
        private String city;
        private String state;
        private String zip;

        public Address() {
        }

        public Address(String street, String city, String state, String zip) {
            this.street = street;
            this.city = city;
            this.state = state;
            this.zip = zip;
        }

        public String getStreet() {
            return street;
        }

        public void setStreet(String street) {
            this.street = street;
        }

        public String getCity() {
            return city;
        }

        public void setCity(String city) {
            this.city = city;
        }

        public String getState() {
            return state;
        }

        public void setState(String state) {
            this.state = state;
        }

        public String getZip() {
            return zip;
        }

        public void setZip(String zip) {
            this.zip = zip;
        }
    }

    public static class AcademicHistory {
        private String academicYearId;
        private String classId;
        private String result;

        public AcademicHistory() {
        }

        public AcademicHistory(String academicYearId, String classId, String result) {
            this.academicYearId = academicYearId;
            this.classId = classId;
            this.result = result;
        }

        public String getAcademicYearId() {
            return academicYearId;
        }

        public void setAcademicYearId(String academicYearId) {
            this.academicYearId = academicYearId;
        }

        public String getClassId() {
            return classId;
        }

        public void setClassId(String classId) {
            this.classId = classId;
        }

        public String getResult() {
            return result;
        }

        public void setResult(String result) {
            this.result = result;
        }
    }

    public static class DocumentRef {
        private String name;
        private String url;

        public DocumentRef() {
        }

        public DocumentRef(String name, String url) {
            this.name = name;
            this.url = url;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }
}
