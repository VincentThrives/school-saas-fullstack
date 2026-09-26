package com.saas.school.modules.classes.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;

@Document(collection = "classes")
public class SchoolClass {
    @Id
    private String classId;
    private String name;
    private String academicYearId;
    private List<Section> sections;

    /**
     * Weekdays this class is <b>not</b> in session — e.g. LKG/UKG/Nursery
     * with {@code [SATURDAY]} when the primary section works Mon–Sat but
     * kindergarten runs Mon–Fri only. Empty or null means the class
     * follows the tenant defaults (Sunday off + declared holidays).
     *
     * <p>Read by {@code AutoAbsentJob} to skip students whose class has
     * today's day-of-week in this list: no ABSENT stamp, no parent SMS.
     * Independent from the global Sunday/holiday guard — a tenant-level
     * {@code WORKING_DAY} override still doesn't force a class in on a
     * day it structurally doesn't attend.</p>
     */
    private List<DayOfWeek> weeklyOffDays;

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

    public List<DayOfWeek> getWeeklyOffDays() {
        return weeklyOffDays;
    }

    public void setWeeklyOffDays(List<DayOfWeek> weeklyOffDays) {
        this.weeklyOffDays = weeklyOffDays;
    }

    // ── Nested types ──────────────────────────────────────────────

    public static class Section {
        private String sectionId;
        private String name;
        private String classTeacherId;
        private int capacity;
        private java.util.List<String> subjectIds;

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

        public java.util.List<String> getSubjectIds() {
            return subjectIds;
        }

        public void setSubjectIds(java.util.List<String> subjectIds) {
            this.subjectIds = subjectIds;
        }
    }
}
