package com.saas.school.modules.syllabus.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "syllabi")
public class Syllabus {

    @Id
    private String id;
    private String tenantId;
    private String classId;
    private String className;
    // NEW — optional section scoping
    private String sectionId;
    private String sectionName;
    private String subjectId;
    private String subjectName;
    private String academicYearId;
    private String academicYearLabel;
    private List<Topic> topics;
    private int totalTopics;
    private int completedTopics;
    private double overallProgress;
    private String teacherId;
    private String teacherName;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public Syllabus() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    /** Mongo _id — exposed to the frontend as "syllabusId". */
    @JsonProperty("syllabusId")
    public String getId() {
        return id;
    }

    @JsonProperty("syllabusId")
    public void setId(String id) {
        this.id = id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public String getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(String subjectId) {
        this.subjectId = subjectId;
    }

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public String getAcademicYearLabel() { return academicYearLabel; }
    public void setAcademicYearLabel(String academicYearLabel) { this.academicYearLabel = academicYearLabel; }

    public List<Topic> getTopics() {
        return topics;
    }

    public void setTopics(List<Topic> topics) {
        this.topics = topics;
    }

    public int getTotalTopics() {
        return totalTopics;
    }

    public void setTotalTopics(int totalTopics) {
        this.totalTopics = totalTopics;
    }

    public int getCompletedTopics() {
        return completedTopics;
    }

    public void setCompletedTopics(int completedTopics) {
        this.completedTopics = completedTopics;
    }

    /** Stored as overallProgress; exposed to the frontend as "progressPercentage". */
    @JsonProperty("progressPercentage")
    public double getOverallProgress() {
        return overallProgress;
    }

    @JsonProperty("progressPercentage")
    public void setOverallProgress(double overallProgress) {
        this.overallProgress = overallProgress;
    }

    public String getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(String teacherId) {
        this.teacherId = teacherId;
    }

    public String getTeacherName() {
        return teacherName;
    }

    public void setTeacherName(String teacherName) {
        this.teacherName = teacherName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum TopicStatus {
        PENDING, IN_PROGRESS, COMPLETED
    }

    public static class Topic {
        private String topicId;        // NEW — stable UUID for frontend addressing
        private String topicName;
        private String description;
        private String plannedDate;
        private String completedDate;
        private TopicStatus status;
        private int completionPercentage;

        public Topic() {
        }

        public Topic(String topicId, String topicName, String description, String plannedDate, String completedDate,
                     TopicStatus status, int completionPercentage) {
            this.topicId = topicId;
            this.topicName = topicName;
            this.description = description;
            this.plannedDate = plannedDate;
            this.completedDate = completedDate;
            this.status = status;
            this.completionPercentage = completionPercentage;
        }

        public String getTopicId() { return topicId; }
        public void setTopicId(String topicId) { this.topicId = topicId; }

        public String getTopicName() {
            return topicName;
        }

        public void setTopicName(String topicName) {
            this.topicName = topicName;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }

        public String getPlannedDate() {
            return plannedDate;
        }

        public void setPlannedDate(String plannedDate) {
            this.plannedDate = plannedDate;
        }

        public String getCompletedDate() {
            return completedDate;
        }

        public void setCompletedDate(String completedDate) {
            this.completedDate = completedDate;
        }

        /** Also expose as completionDate for the frontend interface. */
        @JsonProperty("completionDate")
        public String getCompletionDate() { return completedDate; }

        @JsonProperty("completionDate")
        public void setCompletionDate(String completionDate) { this.completedDate = completionDate; }

        public TopicStatus getStatus() {
            return status;
        }

        public void setStatus(TopicStatus status) {
            this.status = status;
        }

        public int getCompletionPercentage() {
            return completionPercentage;
        }

        public void setCompletionPercentage(int completionPercentage) {
            this.completionPercentage = completionPercentage;
        }
    }
}
