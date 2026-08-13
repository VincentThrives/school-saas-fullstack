package com.saas.school.modules.teacher.dto;

/**
 * Success payload for {@code POST /api/v1/employees/import}. Mirrors
 * {@link com.saas.school.modules.student.dto.StudentImportResult} so the
 * frontend's success card can render the same "Imported N employees"
 * confirmation.
 */
public class EmployeeImportResult {
    private int created;
    /** Existing-employee-id or duplicate-email rows that were silently
     *  skipped (the file itself still validated cleanly overall). */
    private int skipped;

    public EmployeeImportResult() {}

    public EmployeeImportResult(int created, int skipped) {
        this.created = created;
        this.skipped = skipped;
    }

    public int getCreated() { return created; }
    public void setCreated(int created) { this.created = created; }

    public int getSkipped() { return skipped; }
    public void setSkipped(int skipped) { this.skipped = skipped; }
}
