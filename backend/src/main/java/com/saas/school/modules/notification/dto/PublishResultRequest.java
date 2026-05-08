package com.saas.school.modules.notification.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for both {@code POST /api/v1/notifications/publish-result} and the
 * sibling {@code GET …/preview} endpoint. All four scope fields are
 * required except {@code subjectId}, which when blank/null means
 * "publish a combined notification covering every subject of this
 * examType for the given class/section".
 */
public class PublishResultRequest {

    @NotBlank(message = "examType is required")
    private String examType;

    @NotBlank(message = "classId is required")
    private String classId;

    @NotBlank(message = "sectionId is required")
    private String sectionId;

    /** null/blank → combined "All Subjects" notification. */
    private String subjectId;

    /** Optional but recommended — narrows the search and lets the
     *  publish row carry the year for later filtering. */
    private String academicYearId;

    /** Only honoured by /publish-result, not by /preview. When the same
     *  scope has already been published, the endpoint refuses unless
     *  this is true. Preview just returns the existing publishedAt so
     *  the UI can show a banner. */
    private boolean republish;

    public PublishResultRequest() {}

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public boolean isRepublish() { return republish; }
    public void setRepublish(boolean republish) { this.republish = republish; }
}
