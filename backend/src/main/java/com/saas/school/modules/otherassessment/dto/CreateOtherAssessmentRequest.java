package com.saas.school.modules.otherassessment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

/**
 * Payload for creating a new Other Assessment. The service snapshots
 * the current class roster into the {@code students[]} array at create
 * time — the admin doesn't have to build it manually.
 */
public class CreateOtherAssessmentRequest {

    @NotBlank private String academicYearId;
    @NotBlank private String classId;
    @NotBlank private String sectionId;
    @NotBlank private String name;
    private String type;
    @NotNull  private LocalDate testDate;
    @NotNull  private List<SubjectInput> subjects;

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public LocalDate getTestDate() { return testDate; }
    public void setTestDate(LocalDate testDate) { this.testDate = testDate; }

    public List<SubjectInput> getSubjects() { return subjects; }
    public void setSubjects(List<SubjectInput> subjects) { this.subjects = subjects; }

    public static class SubjectInput {
        @NotBlank private String subjectId;
        private String subjectName;
        @NotNull private Integer maxMarks;

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public Integer getMaxMarks() { return maxMarks; }
        public void setMaxMarks(Integer maxMarks) { this.maxMarks = maxMarks; }
    }
}
