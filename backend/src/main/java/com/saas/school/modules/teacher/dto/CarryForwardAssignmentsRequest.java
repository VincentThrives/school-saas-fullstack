package com.saas.school.modules.teacher.dto;

import java.util.List;

public class CarryForwardAssignmentsRequest {

    private String fromAcademicYearId;
    private String toAcademicYearId;
    /** Optional — when empty, carries forward every teacher's active assignments. */
    private List<String> teacherIds;
    /** When true (default), skips any (teacher, class, section, subject) that already exists in the target year. */
    private boolean skipExisting = true;

    public CarryForwardAssignmentsRequest() {
    }

    public String getFromAcademicYearId() { return fromAcademicYearId; }
    public void setFromAcademicYearId(String fromAcademicYearId) { this.fromAcademicYearId = fromAcademicYearId; }

    public String getToAcademicYearId() { return toAcademicYearId; }
    public void setToAcademicYearId(String toAcademicYearId) { this.toAcademicYearId = toAcademicYearId; }

    public List<String> getTeacherIds() { return teacherIds; }
    public void setTeacherIds(List<String> teacherIds) { this.teacherIds = teacherIds; }

    public boolean isSkipExisting() { return skipExisting; }
    public void setSkipExisting(boolean skipExisting) { this.skipExisting = skipExisting; }
}
