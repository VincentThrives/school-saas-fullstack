package com.saas.school.modules.mcq.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "mcq_exams")
public class McqExam {
    @Id private String mcqExamId;
    private String title;
    private String classId;
    private String sectionId;
    private String subjectId;
    private String academicYearId;
    private String createdBy;
    private List<String> questionIds;
    private Instant startTime;
    private Instant endTime;
    private int durationMinutes;
    private boolean shuffleOptions;
    private boolean showResultImmediately;
    private boolean allowRetake;
    private ExamStatus status;
    @CreatedDate private Instant createdAt;

    public enum ExamStatus { DRAFT, PUBLISHED, ONGOING, COMPLETED }

    public McqExam() {
    }

    public McqExam(String mcqExamId, String title, String classId, String sectionId, String subjectId,
                   String academicYearId, String createdBy, List<String> questionIds, Instant startTime,
                   Instant endTime, int durationMinutes, boolean shuffleOptions, boolean showResultImmediately,
                   boolean allowRetake, ExamStatus status, Instant createdAt) {
        this.mcqExamId = mcqExamId;
        this.title = title;
        this.classId = classId;
        this.sectionId = sectionId;
        this.subjectId = subjectId;
        this.academicYearId = academicYearId;
        this.createdBy = createdBy;
        this.questionIds = questionIds;
        this.startTime = startTime;
        this.endTime = endTime;
        this.durationMinutes = durationMinutes;
        this.shuffleOptions = shuffleOptions;
        this.showResultImmediately = showResultImmediately;
        this.allowRetake = allowRetake;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getMcqExamId() { return mcqExamId; }
    public void setMcqExamId(String mcqExamId) { this.mcqExamId = mcqExamId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public List<String> getQuestionIds() { return questionIds; }
    public void setQuestionIds(List<String> questionIds) { this.questionIds = questionIds; }

    public Instant getStartTime() { return startTime; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }

    public Instant getEndTime() { return endTime; }
    public void setEndTime(Instant endTime) { this.endTime = endTime; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public boolean isShuffleOptions() { return shuffleOptions; }
    public void setShuffleOptions(boolean shuffleOptions) { this.shuffleOptions = shuffleOptions; }

    public boolean isShowResultImmediately() { return showResultImmediately; }
    public void setShowResultImmediately(boolean showResultImmediately) { this.showResultImmediately = showResultImmediately; }

    public boolean isAllowRetake() { return allowRetake; }
    public void setAllowRetake(boolean allowRetake) { this.allowRetake = allowRetake; }

    public ExamStatus getStatus() { return status; }
    public void setStatus(ExamStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
