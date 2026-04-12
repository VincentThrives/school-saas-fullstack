package com.saas.school.modules.mcq.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "mcq_questions")
public class McqQuestion {
    @Id private String questionId;
    private String subjectId;
    private String classId;
    private String createdBy;
    private String questionText;
    private List<String> options;
    private int correctOptionIndex;
    private Difficulty difficulty;
    private List<String> tags;
    @CreatedDate private Instant createdAt;

    public enum Difficulty { EASY, MEDIUM, HARD }

    public McqQuestion() {
    }

    public McqQuestion(String questionId, String subjectId, String classId, String createdBy, String questionText,
                       List<String> options, int correctOptionIndex, Difficulty difficulty, List<String> tags,
                       Instant createdAt) {
        this.questionId = questionId;
        this.subjectId = subjectId;
        this.classId = classId;
        this.createdBy = createdBy;
        this.questionText = questionText;
        this.options = options;
        this.correctOptionIndex = correctOptionIndex;
        this.difficulty = difficulty;
        this.tags = tags;
        this.createdAt = createdAt;
    }

    public String getQuestionId() { return questionId; }
    public void setQuestionId(String questionId) { this.questionId = questionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public int getCorrectOptionIndex() { return correctOptionIndex; }
    public void setCorrectOptionIndex(int correctOptionIndex) { this.correctOptionIndex = correctOptionIndex; }

    public Difficulty getDifficulty() { return difficulty; }
    public void setDifficulty(Difficulty difficulty) { this.difficulty = difficulty; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
