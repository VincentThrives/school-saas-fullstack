package com.saas.school.modules.student.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Aggregated response for the "student detail" view in the teacher's
 * My Students page. Contains:
 *   - a snapshot of the student (name, class, section, year)
 *   - attendance for the given academic year: overall + per-subject
 *   - every exam mark the student has for the year, grouped by exam
 */
public class StudentProfileSummary {

    private StudentInfo student = new StudentInfo();
    private AttendanceSummary attendance = new AttendanceSummary();
    private List<ExamMarkRow> exams = new ArrayList<>();

    public StudentProfileSummary() {}

    public StudentInfo getStudent() { return student; }
    public void setStudent(StudentInfo student) { this.student = student; }

    public AttendanceSummary getAttendance() { return attendance; }
    public void setAttendance(AttendanceSummary attendance) { this.attendance = attendance; }

    public List<ExamMarkRow> getExams() { return exams; }
    public void setExams(List<ExamMarkRow> exams) { this.exams = exams; }

    // ── Nested DTOs ─────────────────────────────────────────────────

    public static class StudentInfo {
        private String studentId;
        private String name;
        private String admissionNumber;
        private String rollNumber;
        private String gender;
        private String dateOfBirth;
        private String classId;
        private String className;
        private String sectionId;
        private String sectionName;
        private String academicYearId;
        private String academicYearLabel;
        private String parentName;
        private String parentPhone;

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getAdmissionNumber() { return admissionNumber; }
        public void setAdmissionNumber(String admissionNumber) { this.admissionNumber = admissionNumber; }
        public String getRollNumber() { return rollNumber; }
        public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }
        public String getDateOfBirth() { return dateOfBirth; }
        public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }
        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }
        public String getClassName() { return className; }
        public void setClassName(String className) { this.className = className; }
        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }
        public String getSectionName() { return sectionName; }
        public void setSectionName(String sectionName) { this.sectionName = sectionName; }
        public String getAcademicYearId() { return academicYearId; }
        public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }
        public String getAcademicYearLabel() { return academicYearLabel; }
        public void setAcademicYearLabel(String academicYearLabel) { this.academicYearLabel = academicYearLabel; }
        public String getParentName() { return parentName; }
        public void setParentName(String parentName) { this.parentName = parentName; }
        public String getParentPhone() { return parentPhone; }
        public void setParentPhone(String parentPhone) { this.parentPhone = parentPhone; }
    }

    public static class AttendanceSummary {
        private AttendanceCounts overall = new AttendanceCounts();
        private List<SubjectAttendance> bySubject = new ArrayList<>();

        public AttendanceCounts getOverall() { return overall; }
        public void setOverall(AttendanceCounts overall) { this.overall = overall; }
        public List<SubjectAttendance> getBySubject() { return bySubject; }
        public void setBySubject(List<SubjectAttendance> bySubject) { this.bySubject = bySubject; }
    }

    public static class AttendanceCounts {
        private int present;
        private int absent;
        private int late;
        private int halfDay;
        private int total;
        private double percentage;

        public int getPresent() { return present; }
        public void setPresent(int present) { this.present = present; }
        public int getAbsent() { return absent; }
        public void setAbsent(int absent) { this.absent = absent; }
        public int getLate() { return late; }
        public void setLate(int late) { this.late = late; }
        public int getHalfDay() { return halfDay; }
        public void setHalfDay(int halfDay) { this.halfDay = halfDay; }
        public int getTotal() { return total; }
        public void setTotal(int total) { this.total = total; }
        public double getPercentage() { return percentage; }
        public void setPercentage(double percentage) { this.percentage = percentage; }
    }

    public static class SubjectAttendance {
        private String subjectId;
        private String subjectName;
        private int present;
        private int absent;
        private int late;
        private int total;
        private double percentage;

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
    }

    public static class ExamMarkRow {
        private String examId;
        private String examName;
        private String examType;
        private String examDate;
        private String subjectId;
        private String subjectName;
        private Double marksObtained;
        private double maxMarks;
        private double passingMarks;
        private String grade;
        private Boolean isPassed;

        public String getExamId() { return examId; }
        public void setExamId(String examId) { this.examId = examId; }
        public String getExamName() { return examName; }
        public void setExamName(String examName) { this.examName = examName; }
        public String getExamType() { return examType; }
        public void setExamType(String examType) { this.examType = examType; }
        public String getExamDate() { return examDate; }
        public void setExamDate(String examDate) { this.examDate = examDate; }
        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }
        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
        public Double getMarksObtained() { return marksObtained; }
        public void setMarksObtained(Double marksObtained) { this.marksObtained = marksObtained; }
        public double getMaxMarks() { return maxMarks; }
        public void setMaxMarks(double maxMarks) { this.maxMarks = maxMarks; }
        public double getPassingMarks() { return passingMarks; }
        public void setPassingMarks(double passingMarks) { this.passingMarks = passingMarks; }
        public String getGrade() { return grade; }
        public void setGrade(String grade) { this.grade = grade; }
        public Boolean getIsPassed() { return isPassed; }
        public void setIsPassed(Boolean isPassed) { this.isPassed = isPassed; }
    }
}
