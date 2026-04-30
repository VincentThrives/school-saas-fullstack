package com.saas.school.modules.dashboard.dto;

/**
 * Per-class fee aggregation surfaced on the school admin dashboard.
 * One row per class for the active academic year.
 *
 * Numbers are derived from {@link com.saas.school.modules.fee.model.StudentFeeLedger}
 * when ledgers exist, otherwise from {@link com.saas.school.modules.fee.model.FeeStructure}
 * × roster count so that classes with no payments yet still show a real
 * "amount due" instead of zeros.
 */
public class ClassFeeSummary {

    private String classId;
    private String className;
    private long studentCount;          // total roster size in the class for this year
    private long pendingStudents;       // students with balance > 0
    private double totalDue;            // sum of fee structure × students (ledger snapshot if present)
    private double totalPaid;           // sum of ledger.totalPaid
    private double totalPending;        // totalDue - totalPaid (>= 0)

    public ClassFeeSummary() {}

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public long getStudentCount() { return studentCount; }
    public void setStudentCount(long studentCount) { this.studentCount = studentCount; }

    public long getPendingStudents() { return pendingStudents; }
    public void setPendingStudents(long pendingStudents) { this.pendingStudents = pendingStudents; }

    public double getTotalDue() { return totalDue; }
    public void setTotalDue(double totalDue) { this.totalDue = totalDue; }

    public double getTotalPaid() { return totalPaid; }
    public void setTotalPaid(double totalPaid) { this.totalPaid = totalPaid; }

    public double getTotalPending() { return totalPending; }
    public void setTotalPending(double totalPending) { this.totalPending = totalPending; }
}
