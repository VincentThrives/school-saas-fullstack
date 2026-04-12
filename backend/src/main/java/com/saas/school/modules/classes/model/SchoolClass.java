package com.saas.school.modules.classes.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "classes")
public class SchoolClass {
    @Id
    private String classId;
    private String name;
    private String academicYearId;
    private List<Section> sections;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public SchoolClass() {
    }

    public SchoolClass(String classId, String name, String academicYearId, List<Section> sections,
                       Instant createdAt) {
        this.classId = classId;
        this.name = name;
        this.academicYearId = academicYearId;
        this.sections = sections;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public List<Section> getSections() {
        return sections;
    }

    public void setSections(List<Section> sections) {
        this.sections = sections;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public static class Section {
        private String sectionId;
        private String name;
        private String classTeacherId;
        private int capacity;

        public Section() {
        }

        public Section(String sectionId, String name, String classTeacherId, int capacity) {
            this.sectionId = sectionId;
            this.name = name;
            this.classTeacherId = classTeacherId;
            this.capacity = capacity;
        }

        public String getSectionId() {
            return sectionId;
        }

        public void setSectionId(String sectionId) {
            this.sectionId = sectionId;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getClassTeacherId() {
            return classTeacherId;
        }

        public void setClassTeacherId(String classTeacherId) {
            this.classTeacherId = classTeacherId;
        }

        public int getCapacity() {
            return capacity;
        }

        public void setCapacity(int capacity) {
            this.capacity = capacity;
        }
    }
}
