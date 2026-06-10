package com.saas.school.modules.student.dto;

import java.util.List;

/**
 * Successful bulk-import outcome. Returned only when every row validated
 * cleanly — any error and the backend rejects the whole file with an
 * {@link StudentImportErrorReport} instead (all-or-nothing semantics).
 */
public class StudentImportResult {
    private int totalRows;
    private int created;
    private List<String> studentIds;

    public StudentImportResult() {}

    public StudentImportResult(int totalRows, int created, List<String> studentIds) {
        this.totalRows = totalRows;
        this.created = created;
        this.studentIds = studentIds;
    }

    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }

    public int getCreated() { return created; }
    public void setCreated(int created) { this.created = created; }

    public List<String> getStudentIds() { return studentIds; }
    public void setStudentIds(List<String> studentIds) { this.studentIds = studentIds; }
}
