package com.saas.school.modules.homework.dto;

import com.saas.school.modules.homework.model.HomeworkCompletion.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class MarkHomeworkRequest {

    @NotBlank(message = "studentId is required")
    private String studentId;

    @NotNull(message = "status is required")
    private Status status;

    public MarkHomeworkRequest() {}

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
}
