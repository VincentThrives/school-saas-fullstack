package com.saas.school.modules.exam.dto;

import java.util.List;

/**
 * One row on the Exam Config list page. Each (year, examType) tuple is one
 * config — the backend rolls up the constituent Exam docs into class +
 * subject + marks-status counts so the list view doesn't have to fetch
 * every exam separately.
 */
public class ExamConfigSummary {
    private String academicYearId;
    private String examType;
    private int examCount;
    private List<String> classSectionLabels;   // ["1st - A", "2nd - B", ...]
    private List<String> subjectNames;         // distinct subject names
    private int examsWithMarks;                // how many exams already have student entries
    private String examDate;                   // ISO date string, may be null
    private List<String> examIds;              // ids of all exams in this group

    public ExamConfigSummary() {}

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public int getExamCount() { return examCount; }
    public void setExamCount(int examCount) { this.examCount = examCount; }

    public List<String> getClassSectionLabels() { return classSectionLabels; }
    public void setClassSectionLabels(List<String> classSectionLabels) { this.classSectionLabels = classSectionLabels; }

    public List<String> getSubjectNames() { return subjectNames; }
    public void setSubjectNames(List<String> subjectNames) { this.subjectNames = subjectNames; }

    public int getExamsWithMarks() { return examsWithMarks; }
    public void setExamsWithMarks(int examsWithMarks) { this.examsWithMarks = examsWithMarks; }

    public String getExamDate() { return examDate; }
    public void setExamDate(String examDate) { this.examDate = examDate; }

    public List<String> getExamIds() { return examIds; }
    public void setExamIds(List<String> examIds) { this.examIds = examIds; }
}
