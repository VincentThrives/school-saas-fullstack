package com.saas.school.modules.student.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Row-by-row validation feedback for a rejected bulk import. Every row
 * with at least one problem is listed with its row number (1-indexed,
 * matching Excel — header is row 1, first data row is row 2) and the
 * full list of per-field issues, so the admin can fix everything at
 * once and re-upload.
 *
 * <p>Returned with HTTP 400; carries no created student ids because
 * nothing was saved.
 */
public class StudentImportErrorReport {
    private int totalRows;
    private int validRows;
    private List<RowError> errors = new ArrayList<>();

    public StudentImportErrorReport() {}

    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }

    public int getValidRows() { return validRows; }
    public void setValidRows(int validRows) { this.validRows = validRows; }

    public List<RowError> getErrors() { return errors; }
    public void setErrors(List<RowError> errors) { this.errors = errors; }

    public boolean hasAnyErrors() {
        return errors != null && !errors.isEmpty();
    }

    public static class RowError {
        private int rowNumber;
        private List<FieldError> errors = new ArrayList<>();

        public RowError() {}
        public RowError(int rowNumber) { this.rowNumber = rowNumber; }

        public int getRowNumber() { return rowNumber; }
        public void setRowNumber(int rowNumber) { this.rowNumber = rowNumber; }

        public List<FieldError> getErrors() { return errors; }
        public void setErrors(List<FieldError> errors) { this.errors = errors; }

        public void add(String field, String message) {
            this.errors.add(new FieldError(field, message));
        }
    }

    public static class FieldError {
        private String field;
        private String message;

        public FieldError() {}
        public FieldError(String field, String message) {
            this.field = field;
            this.message = message;
        }

        public String getField() { return field; }
        public void setField(String field) { this.field = field; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
