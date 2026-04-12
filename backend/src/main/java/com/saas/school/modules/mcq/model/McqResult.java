package com.saas.school.modules.mcq.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "mcq_results")
@CompoundIndex(name = "exam_student_unique", def = "{'mcqExamId':1,'studentId':1}", unique = true)
public class McqResult {
    @Id private String resultId;
    private String mcqExamId;
    private String studentId;
    private List<Integer> answers;
    private int score;
    private int totalQuestions;
    private int correctCount;
    private double percentage;
    private boolean isSubmitted;
    private Instant startedAt;
    private Instant submittedAt;
    @CreatedDate private Instant createdAt;

    public McqResult() {
    }

    public McqResult(String resultId, String mcqExamId, String studentId, List<Integer> answers, int score,
                     int totalQuestions, int correctCount, double percentage, boolean isSubmitted,
                     Instant startedAt, Instant submittedAt, Instant createdAt) {
        this.resultId = resultId;
        this.mcqExamId = mcqExamId;
        this.studentId = studentId;
        this.answers = answers;
        this.score = score;
        this.totalQuestions = totalQuestions;
        this.correctCount = correctCount;
        this.percentage = percentage;
        this.isSubmitted = isSubmitted;
        this.startedAt = startedAt;
        this.submittedAt = submittedAt;
        this.createdAt = createdAt;
    }

    public String getResultId() { return resultId; }
    public void setResultId(String resultId) { this.resultId = resultId; }

    public String getMcqExamId() { return mcqExamId; }
    public void setMcqExamId(String mcqExamId) { this.mcqExamId = mcqExamId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public List<Integer> getAnswers() { return answers; }
    public void setAnswers(List<Integer> answers) { this.answers = answers; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public int getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }

    public int getCorrectCount() { return correctCount; }
    public void setCorrectCount(int correctCount) { this.correctCount = correctCount; }

    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }

    public boolean isSubmitted() { return isSubmitted; }
    public void setSubmitted(boolean isSubmitted) { this.isSubmitted = isSubmitted; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
