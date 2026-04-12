package com.saas.school.modules.student.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public class BulkPromoteRequest {

    @NotBlank
    private String fromClassId;

    @NotBlank
    private String fromSectionId;

    @NotBlank
    private String toClassId;

    @NotBlank
    private String toSectionId;

    @NotBlank
    private String toAcademicYearId;

    private List<String> excludedStudentIds;

    public BulkPromoteRequest() {
    }

    public String getFromClassId() {
        return fromClassId;
    }

    public void setFromClassId(String fromClassId) {
        this.fromClassId = fromClassId;
    }

    public String getFromSectionId() {
        return fromSectionId;
    }

    public void setFromSectionId(String fromSectionId) {
        this.fromSectionId = fromSectionId;
    }

    public String getToClassId() {
        return toClassId;
    }

    public void setToClassId(String toClassId) {
        this.toClassId = toClassId;
    }

    public String getToSectionId() {
        return toSectionId;
    }

    public void setToSectionId(String toSectionId) {
        this.toSectionId = toSectionId;
    }

    public String getToAcademicYearId() {
        return toAcademicYearId;
    }

    public void setToAcademicYearId(String toAcademicYearId) {
        this.toAcademicYearId = toAcademicYearId;
    }

    public List<String> getExcludedStudentIds() {
        return excludedStudentIds;
    }

    public void setExcludedStudentIds(List<String> excludedStudentIds) {
        this.excludedStudentIds = excludedStudentIds;
    }
}
