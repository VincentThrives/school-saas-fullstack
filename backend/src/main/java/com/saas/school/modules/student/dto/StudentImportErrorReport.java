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
    /**
     * Section-capacity overflow blockers (computed AFTER row-level
     * validation passes). Separate from per-row errors so the frontend
     * can render a distinct "increase capacity OR trim rows" panel.
     * Empty when no section would overflow.
     */
    private List<CapacityIssue> capacityIssues = new ArrayList<>();

    public StudentImportErrorReport() {}

    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }

    public int getValidRows() { return validRows; }
    public void setValidRows(int validRows) { this.validRows = validRows; }

    public List<RowError> getErrors() { return errors; }
    public void setErrors(List<RowError> errors) { this.errors = errors; }

    public List<CapacityIssue> getCapacityIssues() { return capacityIssues; }
    public void setCapacityIssues(List<CapacityIssue> capacityIssues) { this.capacityIssues = capacityIssues; }

    public boolean hasAnyErrors() {
        return (errors != null && !errors.isEmpty())
            || (capacityIssues != null && !capacityIssues.isEmpty());
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

    /**
     * One overflowing (class, section) pair. Carries enough context for
     * the dialog to show:
     *   "2nd – A : capacity 40, already 12, this upload adds 35
     *    → 47 total. Short by 7. Increase to ≥ 47 or remove rows."
     */
    public static class CapacityIssue {
        private String classId;
        private String className;
        private String sectionId;
        private String sectionName;
        private int capacity;
        /** Existing non-deleted students in this section right now. */
        private int existingCount;
        /** Rows in this upload targeting this section. */
        private int addingCount;
        /** Sum of {@link #existingCount} + {@link #addingCount}. */
        private int totalAfter;
        /** Positive overflow only — {@code totalAfter - capacity}. */
        private int shortBy;

        public CapacityIssue() {}

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getClassName() { return className; }
        public void setClassName(String className) { this.className = className; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }

        public String getSectionName() { return sectionName; }
        public void setSectionName(String sectionName) { this.sectionName = sectionName; }

        public int getCapacity() { return capacity; }
        public void setCapacity(int capacity) { this.capacity = capacity; }

        public int getExistingCount() { return existingCount; }
        public void setExistingCount(int existingCount) { this.existingCount = existingCount; }

        public int getAddingCount() { return addingCount; }
        public void setAddingCount(int addingCount) { this.addingCount = addingCount; }

        public int getTotalAfter() { return totalAfter; }
        public void setTotalAfter(int totalAfter) { this.totalAfter = totalAfter; }

        public int getShortBy() { return shortBy; }
        public void setShortBy(int shortBy) { this.shortBy = shortBy; }
    }
}
