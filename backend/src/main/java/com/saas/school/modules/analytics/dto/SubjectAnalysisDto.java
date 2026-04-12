package com.saas.school.modules.analytics.dto;

public class SubjectAnalysisDto {

    private String subjectName;
    private double averageMarks;
    private double highestMarks;
    private double lowestMarks;
    private int examCount;
    private String trend;

    public SubjectAnalysisDto() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getSubjectName() {
        return subjectName;
    }

    public void setSubjectName(String subjectName) {
        this.subjectName = subjectName;
    }

    public double getAverageMarks() {
        return averageMarks;
    }

    public void setAverageMarks(double averageMarks) {
        this.averageMarks = averageMarks;
    }

    public double getHighestMarks() {
        return highestMarks;
    }

    public void setHighestMarks(double highestMarks) {
        this.highestMarks = highestMarks;
    }

    public double getLowestMarks() {
        return lowestMarks;
    }

    public void setLowestMarks(double lowestMarks) {
        this.lowestMarks = lowestMarks;
    }

    public int getExamCount() {
        return examCount;
    }

    public void setExamCount(int examCount) {
        this.examCount = examCount;
    }

    public String getTrend() {
        return trend;
    }

    public void setTrend(String trend) {
        this.trend = trend;
    }
}
