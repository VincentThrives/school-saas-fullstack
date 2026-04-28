package com.saas.school.modules.student.dto;

import java.util.ArrayList;
import java.util.List;

/** Date-by-date attendance for one student in one subject. Driven by the
 *  My Attendance → View page in the student portal. */
public class SubjectAttendanceDetail {

    private String subjectId;
    private String subjectName;
    private int present;
    private int absent;
    private int late;
    private int total;
    private double percentage;
    private List<DayEntry> entries = new ArrayList<>();

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getSubjectName() { return subjectName; }
    public void setSubjectName(String subjectName) { this.subjectName = subjectName; }

    public int getPresent() { return present; }
    public void setPresent(int present) { this.present = present; }

    public int getAbsent() { return absent; }
    public void setAbsent(int absent) { this.absent = absent; }

    public int getLate() { return late; }
    public void setLate(int late) { this.late = late; }

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }

    public double getPercentage() { return percentage; }
    public void setPercentage(double percentage) { this.percentage = percentage; }

    public List<DayEntry> getEntries() { return entries; }
    public void setEntries(List<DayEntry> entries) { this.entries = entries; }

    public static class DayEntry {
        private String date;          // ISO yyyy-MM-dd
        private int periodNumber;
        private String status;        // PRESENT / ABSENT / LATE / HALF_DAY
        private String remarks;

        public DayEntry() {}
        public DayEntry(String date, int periodNumber, String status, String remarks) {
            this.date = date;
            this.periodNumber = periodNumber;
            this.status = status;
            this.remarks = remarks;
        }

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public int getPeriodNumber() { return periodNumber; }
        public void setPeriodNumber(int periodNumber) { this.periodNumber = periodNumber; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getRemarks() { return remarks; }
        public void setRemarks(String remarks) { this.remarks = remarks; }
    }
}
