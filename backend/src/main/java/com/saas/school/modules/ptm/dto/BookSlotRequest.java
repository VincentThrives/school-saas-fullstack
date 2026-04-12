package com.saas.school.modules.ptm.dto;

public class BookSlotRequest {

    private String slotId;
    private String studentId;

    public BookSlotRequest() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getSlotId() {
        return slotId;
    }

    public void setSlotId(String slotId) {
        this.slotId = slotId;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }
}
