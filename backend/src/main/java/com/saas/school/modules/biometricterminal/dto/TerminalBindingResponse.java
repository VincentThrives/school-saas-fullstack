package com.saas.school.modules.biometricterminal.dto;

import java.time.Instant;

public class TerminalBindingResponse {

    private String terminalUserId;
    private String studentId;
    private String studentName;
    private String rollNumber;
    private String className;
    private String sectionName;
    private Instant boundAt;
    private String boundBy;

    public TerminalBindingResponse() {}

    public String getTerminalUserId() { return terminalUserId; }
    public void setTerminalUserId(String terminalUserId) { this.terminalUserId = terminalUserId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public Instant getBoundAt() { return boundAt; }
    public void setBoundAt(Instant boundAt) { this.boundAt = boundAt; }

    public String getBoundBy() { return boundBy; }
    public void setBoundBy(String boundBy) { this.boundBy = boundBy; }
}
