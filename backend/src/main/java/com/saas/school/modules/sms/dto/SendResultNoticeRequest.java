package com.saas.school.modules.sms.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request body for {@code POST /api/v1/sms/result-notice} — fired from
 * the "Publish Result SMS" card on the school admin's SMS Notifications
 * page.
 *
 * <p>Unlike Holiday / Event notices (which broadcast the same body to
 * everyone in the audience), result SMS is <strong>per-student</strong>:
 * each parent gets THEIR child's name + result summary slotted into the
 * RESULT_COMBINED DLT template's {@code {#var#}} placeholders. So we
 * don't take an {@link SmsAudience} list — we take a list of (class,
 * section) pairs and fan out to every student inside.</p>
 *
 * <p>Variables stamped per-student in dispatch:</p>
 * <ul>
 *   <li>{@code var1} — student's name</li>
 *   <li>{@code var2} — {@code examName} from this request</li>
 *   <li>{@code var3} — per-student result summary (e.g. {@code "78.5%"})</li>
 * </ul>
 *
 * <p>Phone numbers come from <strong>both</strong> Student.parentPhone
 * (free-text field, almost always set at admission) AND linked Parent
 * User accounts via Student.parentIds. Phone-level dedupe inside
 * SmsService.resolveRecipients guarantees one SMS per phone even when
 * a parent appears in both sources.</p>
 */
public class SendResultNoticeRequest {

    /** Which exam to publish — e.g. "FINAL", "UNIT_TEST_1". Used to
     *  filter exams when computing each student's result summary. */
    @NotBlank(message = "examType is required")
    @Size(max = 80)
    private String examType;

    /** Optional friendly exam name slotted into var2 of the DLT template
     *  — e.g. "Unit Test 1", "Final Exam". When blank, the backend
     *  falls back to {@code examType} (the school's exam-type label
     *  is already friendly — same source as the picker dropdown). Kept
     *  under 80 chars to leave room for the rest of the body inside
     *  MSG91's 160-char fragment. */
    @Size(max = 80)
    private String examName;

    /** Optional academic-year filter — only exams in this year are
     *  considered when computing the summary. Null/blank = all years. */
    private String academicYearId;

    /** One or more (classId, sectionId) pairs. SMS fans out to every
     *  student in EACH listed section. Multi-pick lets the admin
     *  publish results for 3-A, 3-B and 5-C in one go. */
    @NotEmpty(message = "Pick at least one class + section")
    @Valid
    private List<TargetSection> targets;

    public SendResultNoticeRequest() {}

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public String getExamName() { return examName; }
    public void setExamName(String examName) { this.examName = examName; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public List<TargetSection> getTargets() { return targets; }
    public void setTargets(List<TargetSection> targets) { this.targets = targets; }

    /** One (classId, sectionId) pick in the multi-target list. */
    public static class TargetSection {
        @NotBlank(message = "classId is required")
        private String classId;

        @NotBlank(message = "sectionId is required")
        private String sectionId;

        public TargetSection() {}
        public TargetSection(String classId, String sectionId) {
            this.classId = classId;
            this.sectionId = sectionId;
        }

        public String getClassId() { return classId; }
        public void setClassId(String classId) { this.classId = classId; }

        public String getSectionId() { return sectionId; }
        public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    }
}
