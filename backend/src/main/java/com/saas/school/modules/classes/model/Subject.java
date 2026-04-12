package com.saas.school.modules.classes.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "subjects")
public class Subject {
    @Id
    private String subjectId;
    private String name;
    private String code;
    private String classId;
    private String academicYearId;
    private SubjectType type;
    private List<TeacherAssignment> teacherAssignments;

    @CreatedDate
    private Instant createdAt;

    // ── Constructors ──────────────────────────────────────────────

    public Subject() {
    }

    public Subject(String subjectId, String name, String code, String classId, String academicYearId,
                   SubjectType type, List<TeacherAssignment> teacherAssignments, Instant createdAt) {
        this.subjectId = subjectId;
        this.name = name;
        this.code = code;
        this.classId = classId;
        this.academicYearId = academicYearId;
        this.type = type;
        this.teacherAssignments = teacherAssignments;
        this.createdAt = createdAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getSubjectId() {
        return subjectId;
    }

    public void setSubjectId(String subjectId) {
        this.subjectId = subjectId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getClassId() {
        return classId;
    }

    public void setClassId(String classId) {
        this.classId = classId;
    }

    public String getAcademicYearId() {
        return academicYearId;
    }

    public void setAcademicYearId(String academicYearId) {
        this.academicYearId = academicYearId;
    }

    public SubjectType getType() {
        return type;
    }

    public void setType(SubjectType type) {
        this.type = type;
    }

    public List<TeacherAssignment> getTeacherAssignments() {
        return teacherAssignments;
    }

    public void setTeacherAssignments(List<TeacherAssignment> teacherAssignments) {
        this.teacherAssignments = teacherAssignments;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum SubjectType { THEORY, PRACTICAL, ELECTIVE }

    public static class TeacherAssignment {
        private String teacherId;
        private String sectionId;

        public TeacherAssignment() {
        }

        public TeacherAssignment(String teacherId, String sectionId) {
            this.teacherId = teacherId;
            this.sectionId = sectionId;
        }

        public String getTeacherId() {
            return teacherId;
        }

        public void setTeacherId(String teacherId) {
            this.teacherId = teacherId;
        }

        public String getSectionId() {
            return sectionId;
        }

        public void setSectionId(String sectionId) {
            this.sectionId = sectionId;
        }
    }
}
