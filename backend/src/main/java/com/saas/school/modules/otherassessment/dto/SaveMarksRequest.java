package com.saas.school.modules.otherassessment.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Bulk-save the whole student roster for an assessment in one shot.
 * Whatever's sent here fully replaces the persisted {@code students[]}
 * array on the doc — the frontend loads the doc first, edits marks
 * in place, and posts back the full list. Simpler than diff-based
 * updates and matches the spreadsheet mental model the admin has.
 */
public class SaveMarksRequest {

    @NotNull
    private List<StudentInput> students;

    public List<StudentInput> getStudents() { return students; }
    public void setStudents(List<StudentInput> students) { this.students = students; }

    public static class StudentInput {
        private String studentId;
        private String rollNumber;
        private String fullName;
        private String remark;
        private List<SubjectInput> subjects;

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }
        public String getRollNumber() { return rollNumber; }
        public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
        public List<SubjectInput> getSubjects() { return subjects; }
        public void setSubjects(List<SubjectInput> subjects) { this.subjects = subjects; }
    }

    public static class SubjectInput {
        private String subjectId;
        private Double marksObtained;
        private String remark;

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public Double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
    }
}
