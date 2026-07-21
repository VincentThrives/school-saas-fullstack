package com.saas.school.modules.auth.dto;

/**
 * Compact row for the header "Switch student" list. Returned by
 * {@code GET /auth/siblings} — one entry per sibling of the currently
 * signed-in student (same parentPhone, same tenant), caller excluded.
 *
 * <p>{@code userId} is the JWT-subject of the sibling's user account and
 * is what the switch endpoint targets when swapping tokens.</p>
 */
public class SiblingStudentDto {
    private String studentId;
    private String userId;
    private String fullName;
    private String rollNumber;
    private String className;
    private String sectionName;

    public SiblingStudentDto() {}

    public SiblingStudentDto(String studentId, String userId, String fullName,
                             String rollNumber, String className, String sectionName) {
        this.studentId = studentId;
        this.userId = userId;
        this.fullName = fullName;
        this.rollNumber = rollNumber;
        this.className = className;
        this.sectionName = sectionName;
    }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
}
