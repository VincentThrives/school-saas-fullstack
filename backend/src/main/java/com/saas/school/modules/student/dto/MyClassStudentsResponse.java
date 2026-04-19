package com.saas.school.modules.student.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for GET /api/v1/students/my-class — the single endpoint used by
 * the teacher's "My Students" page.
 *
 * If {@link #classTeacher} is false, the caller is not a class teacher for
 * any section and should show the "you are not a class teacher" message.
 * Otherwise the list of class-teacher classes is returned, each with its
 * students already populated.
 */
public class MyClassStudentsResponse {

    private boolean classTeacher;
    private String reason;                         // e.g. "NO_PROFILE", "NO_CLASS_TEACHER_ROLE"
    private List<ClassStudents> classes = new ArrayList<>();

    public MyClassStudentsResponse() {}

    public boolean isClassTeacher() { return classTeacher; }
    public void setClassTeacher(boolean classTeacher) { this.classTeacher = classTeacher; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public List<ClassStudents> getClasses() { return classes; }
    public void setClasses(List<ClassStudents> classes) {
        this.classes = classes == null ? new ArrayList<>() : classes;
    }

    public static class ClassStudents {
        private String academicYearId;
        private String academicYearLabel;
        private String classId;
        private String className;
        private String sectionId;
        private String sectionName;
        private List<StudentDto> students = new ArrayList<>();

        public ClassStudents() {}

        public String getAcademicYearId() { return academicYearId; }
        public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

        public String getAcademicYearLabel() { return academicYearLabel; }
        public void setAcademicYearLabel(String academicYearLabel) { this.academicYearLabel = academicYearLabel; }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getClassName() { return className; }
        public void setClassName(String className) { this.className = className; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }

        public String getSectionName() { return sectionName; }
        public void setSectionName(String sectionName) { this.sectionName = sectionName; }

        public List<StudentDto> getStudents() { return students; }
        public void setStudents(List<StudentDto> students) {
            this.students = students == null ? new ArrayList<>() : students;
        }
    }
}
