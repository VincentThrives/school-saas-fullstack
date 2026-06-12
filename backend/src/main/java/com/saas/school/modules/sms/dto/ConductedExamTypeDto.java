package com.saas.school.modules.sms.dto;

import java.util.List;

/**
 * Response row for {@code GET /api/v1/sms/result-notice/exam-types}.
 *
 * <p>Drives the two dropdowns on the "Publish Result SMS" card:</p>
 * <ol>
 *   <li>An Exam Type dropdown — one entry per distinct {@code Exam.examType}
 *       that has at least one Exam document in the tenant. Catalog exam
 *       types that have NEVER been used drop out.</li>
 *   <li>A "Class + section" multi-select that's narrowed to the sections
 *       where the picked exam type actually has exams — so the admin
 *       can't pick a section that has no marks to publish.</li>
 * </ol>
 *
 * <p>One round-trip on card open; no per-pick chatter.</p>
 */
public class ConductedExamTypeDto {

    /** The exam type string as stored on {@code Exam.examType} —
     *  typically the school's friendly label ("Unit Test 1", "Final Exam").
     *  Used as var2's exam-name fragment in the SMS body when the request
     *  doesn't carry an explicit override. */
    private String examType;

    /** Every (classId, sectionId) where this exam type has exams created.
     *  Carries display labels too so the multi-select can show
     *  "1st - A" without a separate class lookup. */
    private List<ClassSection> sections;

    public ConductedExamTypeDto() {}

    public ConductedExamTypeDto(String examType, List<ClassSection> sections) {
        this.examType = examType;
        this.sections = sections;
    }

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public List<ClassSection> getSections() { return sections; }
    public void setSections(List<ClassSection> sections) { this.sections = sections; }

    /** One (class, section) row inside a conducted-exam-type bucket. */
    public static class ClassSection {
        private String classId;
        private String sectionId;
        /** Class display name as denormalised on the Exam doc — e.g. "1st". */
        private String classLabel;
        /** Section display name as denormalised on the Exam doc — e.g. "A". */
        private String sectionLabel;

        public ClassSection() {}
        public ClassSection(String classId, String sectionId,
                            String classLabel, String sectionLabel) {
            this.classId = classId;
            this.sectionId = sectionId;
            this.classLabel = classLabel;
            this.sectionLabel = sectionLabel;
        }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }

        public String getClassLabel() { return classLabel; }
        public void setClassLabel(String classLabel) { this.classLabel = classLabel; }

        public String getSectionLabel() { return sectionLabel; }
        public void setSectionLabel(String sectionLabel) { this.sectionLabel = sectionLabel; }
    }
}
