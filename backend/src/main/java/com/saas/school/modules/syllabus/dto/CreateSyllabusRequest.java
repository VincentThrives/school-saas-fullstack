package com.saas.school.modules.syllabus.dto;

import java.util.List;

public class CreateSyllabusRequest {

    private String classId;
    private String sectionId;    // NEW — optional
    private String subjectId;
    private String subjectName;
    private String academicYearId;
    private List<TopicRequest> topics;

    public CreateSyllabusRequest() {
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

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

    public List<TopicRequest> getTopics() {
        return topics;
    }

    public void setTopics(List<TopicRequest> topics) {
        this.topics = topics;
    }

    public static class TopicRequest {
        private String topicId; // Optional — preserved on edit, generated on create
        private String topicName;
        private String description;
        private String plannedDate;

        public TopicRequest() {
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
    }
}
