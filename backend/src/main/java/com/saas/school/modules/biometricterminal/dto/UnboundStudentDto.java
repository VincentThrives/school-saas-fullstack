package com.saas.school.modules.biometricterminal.dto;

/**
 * One row in the "Unbound Students" per-terminal audit dialog — a
 * student in this tenant who doesn't have a {@link
 * com.saas.school.modules.biometricterminal.model.TerminalUserBinding}
 * on the specified terminal serial. Feeds the admin's "who haven't
 * we enrolled yet on the school gate?" workflow.
 */
public class UnboundStudentDto {
    private String studentId;
    private String name;
    private String className;
    private String sectionName;
    private String rollNumber;
    private String admissionNumber;

    public UnboundStudentDto() {}

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getAdmissionNumber() { return admissionNumber; }
    public void setAdmissionNumber(String admissionNumber) { this.admissionNumber = admissionNumber; }
}
