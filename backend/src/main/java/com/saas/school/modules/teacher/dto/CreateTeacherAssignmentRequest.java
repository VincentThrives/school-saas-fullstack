package com.saas.school.modules.teacher.dto;

import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;

import java.util.Set;

public class CreateTeacherAssignmentRequest {

    private String teacherId;
    private String academicYearId;
    private String classId;
    private String sectionId;
    private String subjectId;
    private Set<TeacherSubjectAssignment.Role> roles;

    public CreateTeacherAssignmentRequest() {
    }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public Set<TeacherSubjectAssignment.Role> getRoles() { return roles; }
    public void setRoles(Set<TeacherSubjectAssignment.Role> roles) { this.roles = roles; }
}
