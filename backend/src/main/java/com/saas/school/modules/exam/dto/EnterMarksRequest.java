package com.saas.school.modules.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

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
        /**
         * For combined-mode exams, marks per component keyed by component
         * key ({"theory": 35, "ia": 8}). When non-null the service uses
         * these instead of {@link #marksObtained} and validates each cell
         * against the matching component's own max.
         */
        private Map<String, Double> componentMarks;
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

        public Map<String, Double> getComponentMarks() {
            return componentMarks;
        }

        public void setComponentMarks(Map<String, Double> componentMarks) {
            this.componentMarks = componentMarks;
        }

        public String getRemarks() {
            return remarks;
        }

        public void setRemarks(String remarks) {
            this.remarks = remarks;
        }
    }
}
