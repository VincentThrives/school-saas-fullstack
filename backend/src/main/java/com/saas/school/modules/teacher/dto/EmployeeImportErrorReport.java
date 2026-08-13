package com.saas.school.modules.teacher.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Row-by-row error report returned by
 * {@code POST /api/v1/employees/import} when any row fails validation.
 * All-or-nothing — the whole file is rejected so admins know they never
 * end up with a half-imported batch. Frontend renders each entry as a
 * row in a scrollable error list so the admin can fix the sheet and
 * re-upload.
 */
public class EmployeeImportErrorReport {
    private List<RowError> errors = new ArrayList<>();

    public List<RowError> getErrors() { return errors; }
    public void setErrors(List<RowError> errors) { this.errors = errors; }

    public void add(int row, String column, String message) {
        this.errors.add(new RowError(row, column, message));
    }

    public boolean isEmpty() {
        return errors == null || errors.isEmpty();
    }

    public static class RowError {
        /** 1-based row number as it appears in Excel (header = row 1,
         *  first data row = 2). Matches what the admin sees when they
         *  open the file. */
        private int row;
        /** Header name of the column with the issue, or "(row)" for
         *  whole-row problems like duplicate keys. */
        private String column;
        private String message;

        public RowError() {}

        public RowError(int row, String column, String message) {
            this.row = row;
            this.column = column;
            this.message = message;
        }

        public int getRow() { return row; }
        public void setRow(int row) { this.row = row; }

        public String getColumn() { return column; }
        public void setColumn(String column) { this.column = column; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
