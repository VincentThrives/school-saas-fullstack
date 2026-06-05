package com.saas.school.modules.exam.dto;

import java.util.List;

/**
 * Bulk request: enter / update internal marks for a whole class on a
 * single (subject, component, year, term) tuple.
 *
 * <p>{@code termId} may be null when the target component's
 * {@code internalSchedule} is {@code PER_YEAR}.
 */
public class EnterInternalMarksRequest {

    private String subjectId;
    private String componentKey;
    private String academicYearId;
    private String termId;       // nullable for PER_YEAR components
    private List<Entry> entries;

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getComponentKey() { return componentKey; }
    public void setComponentKey(String componentKey) { this.componentKey = componentKey; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getTermId() { return termId; }
    public void setTermId(String termId) { this.termId = termId; }

    public List<Entry> getEntries() { return entries; }
    public void setEntries(List<Entry> entries) { this.entries = entries; }

    public static class Entry {
        private String studentId;
        private Double marksObtained;
        private String remarks;

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }

        public Double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }

        public String getRemarks() { return remarks; }
        public void setRemarks(String remarks) { this.remarks = remarks; }
    }
}
