package com.saas.school.modules.exam.dto;

import com.saas.school.modules.exam.model.Exam;

import java.time.LocalDate;
import java.util.List;

/**
 * Full pre-fill payload for the Exam Config edit form. Carries the exact
 * pairs + subject configs the admin originally submitted, derived from the
 * existing Exam docs in this group. Saving an edit deletes those docs (and
 * their student marks) and recreates fresh — see ExamService.bulkCreate.
 */
public class ExamConfigDetail {
    private String academicYearId;
    /** The exam-NAME prefix used for grouping ("FA1"). Stays stable across
     *  edits so the Config URL / card label don't change out from under the
     *  admin. */
    private String examType;
    /** The actual exam TYPE stamped on each exam doc ("FA" from the catalog).
     *  Drives the "Exam Type" dropdown's pre-selection in edit mode so the
     *  admin sees "FA1 belongs to FA" at a glance. */
    private String examTypeKey;
    /** Scheme + slot provenance, when the group came from a scheme rollout.
     *  Round-tripped through the Config edit so saving preserves the link. */
    private String schemeId;
    private String slotKey;
    private LocalDate examDate;
    private String startTime;
    private String endTime;
    private String description;
    private List<BulkCreateExamRequest.ClassSection> pairs;
    private List<BulkCreateExamRequest.SubjectConfig> subjectConfigs;
    private boolean anyMarksEntered;

    public ExamConfigDetail() {}

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public String getExamTypeKey() { return examTypeKey; }
    public void setExamTypeKey(String examTypeKey) { this.examTypeKey = examTypeKey; }

    public String getSchemeId() { return schemeId; }
    public void setSchemeId(String schemeId) { this.schemeId = schemeId; }

    public String getSlotKey() { return slotKey; }
    public void setSlotKey(String slotKey) { this.slotKey = slotKey; }

    public LocalDate getExamDate() { return examDate; }
    public void setExamDate(LocalDate examDate) { this.examDate = examDate; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<BulkCreateExamRequest.ClassSection> getPairs() { return pairs; }
    public void setPairs(List<BulkCreateExamRequest.ClassSection> pairs) { this.pairs = pairs; }

    public List<BulkCreateExamRequest.SubjectConfig> getSubjectConfigs() { return subjectConfigs; }
    public void setSubjectConfigs(List<BulkCreateExamRequest.SubjectConfig> subjectConfigs) { this.subjectConfigs = subjectConfigs; }

    public boolean isAnyMarksEntered() { return anyMarksEntered; }
    public void setAnyMarksEntered(boolean anyMarksEntered) { this.anyMarksEntered = anyMarksEntered; }
}
