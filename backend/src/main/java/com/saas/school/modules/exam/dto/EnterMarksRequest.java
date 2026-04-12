package com.saas.school.modules.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class EnterMarksRequest {

    @NotBlank
    private String examId;

    @NotNull
    private List<MarkEntry> marks;

    public EnterMarksRequest() {
    }

    public String getExamId() {
        return examId;
    }

    public void setExamId(String examId) {
        this.examId = examId;
    }

    public List<MarkEntry> getMarks() {
        return marks;
    }

    public void setMarks(List<MarkEntry> marks) {
        this.marks = marks;
    }

    public static class MarkEntry {

        private String studentId;
        private Double marksObtained;
        private String remarks;

        public MarkEntry() {
        }

        public String getStudentId() {
            return studentId;
        }

        public void setStudentId(String studentId) {
            this.studentId = studentId;
        }

        public Double getMarksObtained() {
            return marksObtained;
        }

        public void setMarksObtained(Double marksObtained) {
            this.marksObtained = marksObtained;
        }

        public String getRemarks() {
            return remarks;
        }

        public void setRemarks(String remarks) {
            this.remarks = remarks;
        }
    }
}
