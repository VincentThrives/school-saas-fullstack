package com.saas.school.modules.hr.dto;

/**
 * Body of HR's approve / reject action. Notes are optional on
 * approve, strongly recommended on reject so the employee sees why
 * their request was turned down.
 */
public class RegularizationReviewRequest {

    private String notes;

    public RegularizationReviewRequest() {}

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
