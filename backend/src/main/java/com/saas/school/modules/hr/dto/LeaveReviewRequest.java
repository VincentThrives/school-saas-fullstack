package com.saas.school.modules.hr.dto;

/** Payload for {@code POST /leave/{id}/approve} and
 *  {@code POST /leave/{id}/reject}. Notes are required on reject
 *  (enforced service-side) and optional on approve. */
public class LeaveReviewRequest {
    private String notes;
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
