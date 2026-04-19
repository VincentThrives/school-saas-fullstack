package com.saas.school.modules.teacher.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Year-scoped mapping of a teacher to a class + section + subject.
 *
 * A single row can represent a Class Teacher, a Subject Teacher, or both
 * simultaneously (roles is a Set).
 *
 * Multi-tenant routing is handled by TenantMongoDbFactory, so no tenantId
 * field is required here.
 */
@Document(collection = "teacher_subject_assignments")
@CompoundIndex(name = "teacher_year_class_section_subject_idx",
        def = "{'teacherId':1,'academicYearId':1,'classId':1,'sectionId':1,'subjectId':1}",
        unique = true)
public class TeacherSubjectAssignment {

    @Id
    private String assignmentId;

    private String teacherId;
    private String academicYearId;
    private String classId;
    private String sectionId;    // optional — null means whole class
    private String subjectId;    // optional — null when role is CLASS_TEACHER only

    private Set<Role> roles = new HashSet<>();
    private Status status = Status.ACTIVE;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public TeacherSubjectAssignment() {
    }

    // ── Getters and Setters ──────────────────────────────────────────

    public String getAssignmentId() { return assignmentId; }
    public void setAssignmentId(String assignmentId) { this.assignmentId = assignmentId; }

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

    public Set<Role> getRoles() { return roles; }
    public void setRoles(Set<Role> roles) { this.roles = roles == null ? new HashSet<>() : roles; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    // ── Convenience ──────────────────────────────────────────────────

    public boolean isClassTeacher() { return roles != null && roles.contains(Role.CLASS_TEACHER); }
    public boolean isSubjectTeacher() { return roles != null && roles.contains(Role.SUBJECT_TEACHER); }

    // ── Nested types ─────────────────────────────────────────────────

    public enum Role {
        CLASS_TEACHER,
        SUBJECT_TEACHER,
    }

    public enum Status {
        ACTIVE,
        ARCHIVED,
    }
}
