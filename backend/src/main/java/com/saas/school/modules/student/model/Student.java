package com.saas.school.modules.student.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "students")
public class Student {
    @Id private String studentId;
    private String userId;

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

    @CreatedDate private Instant createdAt;
    private Instant deletedAt;

    public enum Gender { MALE, FEMALE, OTHER }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Address {
        private String street, city, state, zip;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AcademicHistory {
        private String academicYearId, classId, result;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DocumentRef {
        private String name, url;
    }
}
