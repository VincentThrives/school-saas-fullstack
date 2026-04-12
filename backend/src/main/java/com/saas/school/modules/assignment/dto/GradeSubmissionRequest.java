package com.saas.school.modules.assignment.dto;

public class GradeSubmissionRequest {

    private int marksAwarded;
    private String remarks;

    public GradeSubmissionRequest() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public int getMarksAwarded() {
        return marksAwarded;
    }

    public void setMarksAwarded(int marksAwarded) {
        this.marksAwarded = marksAwarded;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }
}
