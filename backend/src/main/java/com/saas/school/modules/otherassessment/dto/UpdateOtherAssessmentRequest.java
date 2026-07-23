package com.saas.school.modules.otherassessment.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Edit payload for an existing Other Assessment. Deliberately narrow:
 * only date and the subject roster can change — name / type / class /
 * section stay fixed after create so historical marks stay attached to
 * the assessment they were entered against.
 *
 * <p>The subject list in this payload REPLACES the doc's subject list.
 * The service compares old vs new: subjects that disappear from the
 * new list are removed (only allowed when no student has marks in
 * that subject); subjects that appear as new are appended, and a
 * blank mark row is seeded on every student for the new subject.
 * Max marks on existing subjects can change freely — a school
 * upgrading a 40-mark Physics paper to 45 doesn't lose historical
 * marks.</p>
 */
public class UpdateOtherAssessmentRequest {

    private LocalDate testDate;
    private List<CreateOtherAssessmentRequest.SubjectInput> subjects;

    public LocalDate getTestDate() { return testDate; }
    public void setTestDate(LocalDate testDate) { this.testDate = testDate; }

    public List<CreateOtherAssessmentRequest.SubjectInput> getSubjects() { return subjects; }
    public void setSubjects(List<CreateOtherAssessmentRequest.SubjectInput> subjects) { this.subjects = subjects; }
}
