package com.saas.school.modules.syllabus.dto;

/** Updates a single topic's progress. Frontend sends topicId + status + completionPercentage. */
public class UpdateTopicRequest {

    private String topicId;
    private String status;
    private int completionPercentage;
    private String completedDate;

    public UpdateTopicRequest() {
    }

    public String getTopicId() { return topicId; }
    public void setTopicId(String topicId) { this.topicId = topicId; }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getCompletionPercentage() {
        return completionPercentage;
    }

    public void setCompletionPercentage(int completionPercentage) {
        this.completionPercentage = completionPercentage;
    }

    public String getCompletedDate() {
        return completedDate;
    }

    public void setCompletedDate(String completedDate) {
        this.completedDate = completedDate;
    }
}
