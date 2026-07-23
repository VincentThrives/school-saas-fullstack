package com.saas.school.modules.otherassessment.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.otherassessment.dto.CreateOtherAssessmentRequest;
import com.saas.school.modules.otherassessment.dto.SaveMarksRequest;
import com.saas.school.modules.otherassessment.dto.UpdateOtherAssessmentRequest;
import com.saas.school.modules.otherassessment.model.OtherAssessment;
import com.saas.school.modules.otherassessment.repository.OtherAssessmentRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Business logic for the Other Assessments feature — creation,
 * listing, per-student roster view, marks bulk-save.
 *
 * <p>Kept entirely separate from Exam / ExamMark / ReportCard so
 * changes here can't ripple into the academic marking pipeline.</p>
 */
@Service
public class OtherAssessmentService {

    @Autowired private OtherAssessmentRepository assessmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private AuditService auditService;

    /**
     * Create a new assessment and snapshot the current class roster
     * into the {@code students[]} array. Each student starts with a
     * blank mark row per subject — the admin fills them in later via
     * the marks-entry page.
     */
    public OtherAssessment create(CreateOtherAssessmentRequest req, String userId) {
        validate(req);

        OtherAssessment doc = new OtherAssessment();
        doc.setAssessmentId(UUID.randomUUID().toString());
        doc.setAcademicYearId(req.getAcademicYearId());
        doc.setClassId(req.getClassId());
        doc.setSectionId(req.getSectionId());
        doc.setName(req.getName().trim());
        doc.setType(req.getType() == null ? null : req.getType().trim());
        doc.setTestDate(req.getTestDate());
        doc.setCreatedBy(userId);
        doc.setUpdatedBy(userId);

        List<OtherAssessment.SubjectSpec> subjects = new ArrayList<>();
        for (var s : req.getSubjects()) {
            subjects.add(new OtherAssessment.SubjectSpec(
                    s.getSubjectId(),
                    s.getSubjectName(),
                    s.getMaxMarks()));
        }
        doc.setSubjects(subjects);

        // Snapshot the roster — students in this section, sorted by
        // roll number (nulls last) so the marks-entry table reads in a
        // stable order the admin recognises.
        List<Student> roster = studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(
                req.getClassId(), req.getSectionId());
        roster.sort(Comparator.comparing(
                Student::getRollNumber,
                Comparator.nullsLast(String::compareToIgnoreCase)));

        List<OtherAssessment.StudentEntry> students = new ArrayList<>();
        for (Student s : roster) {
            OtherAssessment.StudentEntry entry = new OtherAssessment.StudentEntry(
                    s.getStudentId(),
                    s.getRollNumber(),
                    fullName(s));
            entry.setAdmissionNumber(s.getAdmissionNumber());
            // Seed one blank mark row per subject so the frontend
            // doesn't have to reconcile subjectIds on first render.
            List<OtherAssessment.SubjectMark> marks = new ArrayList<>();
            for (var spec : subjects) {
                marks.add(new OtherAssessment.SubjectMark(spec.getSubjectId(), null));
            }
            entry.setSubjects(marks);
            students.add(entry);
        }
        doc.setStudents(students);

        OtherAssessment saved = assessmentRepository.save(doc);
        auditService.log("OTHER_ASSESSMENT_CREATE", "OtherAssessment", saved.getAssessmentId(),
                "Created " + saved.getName() + " for class=" + saved.getClassId()
                        + " section=" + saved.getSectionId()
                        + " students=" + students.size());
        return saved;
    }

    /** Admin list — optionally filtered by class, section, and type.
     *  {@code academicYearId} is the only hard requirement so an admin
     *  can pick "All Classes" and get every assessment for the year in
     *  one view. When {@code archived=true} the same filters apply but
     *  the query switches to soft-deleted rows only — powers the
     *  admin's Archive view. */
    public List<OtherAssessment> list(String classId, String sectionId,
                                      String academicYearId, String type,
                                      boolean archived) {
        if (academicYearId == null || academicYearId.isBlank()) {
            throw new BusinessException("academicYearId is required.");
        }
        boolean hasClass = classId != null && !classId.isBlank();
        boolean hasSection = sectionId != null && !sectionId.isBlank();
        List<OtherAssessment> rows;
        if (archived) {
            if (hasClass && hasSection) {
                rows = assessmentRepository
                        .findByClassIdAndSectionIdAndAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(
                                classId, sectionId, academicYearId);
            } else if (hasClass) {
                rows = assessmentRepository
                        .findByClassIdAndAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(
                                classId, academicYearId);
            } else {
                rows = assessmentRepository
                        .findByAcademicYearIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(academicYearId);
            }
        } else {
            if (hasClass && hasSection) {
                rows = assessmentRepository
                        .findByClassIdAndSectionIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
                                classId, sectionId, academicYearId);
            } else if (hasClass) {
                rows = assessmentRepository
                        .findByClassIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
                                classId, academicYearId);
            } else {
                rows = assessmentRepository
                        .findByAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(academicYearId);
            }
        }
        if (type != null && !type.isBlank()) {
            String needle = type.trim();
            rows.removeIf(r -> r.getType() == null || !r.getType().equalsIgnoreCase(needle));
        }
        return rows;
    }

    /**
     * Student-side listing — every LIVE (non-archived) assessment the
     * caller's student row appears in, most recent test date first.
     * Only the caller's own marks are surfaced; other students on the
     * assessment doc are stripped so parents can't see peers' scores.
     *
     * <p>Returns each row as a {@link StudentAssessmentView} — enough
     * for a per-student list ("CET Week 1: 47/180 (26.1%)") without
     * leaking the whole class's data.</p>
     */
    public List<StudentAssessmentView> listForStudent(String userId) {
        if (userId == null || userId.isBlank()) return Collections.emptyList();
        var studentOpt = studentRepository.findByUserIdAndDeletedAtIsNull(userId);
        if (studentOpt.isEmpty()) return Collections.emptyList();
        var student = studentOpt.get();
        String studentId = student.getStudentId();
        String academicYearId = student.getAcademicYearId();
        String classId = student.getClassId();
        String sectionId = student.getSectionId();
        if (studentId == null || academicYearId == null) return Collections.emptyList();

        // Scope by class/section first — cheap Mongo query — then in
        // memory filter down to rows where this specific student has
        // an entry (handles late-transfer edge cases where the
        // student joined after the assessment was created).
        List<OtherAssessment> rows;
        if (classId != null && sectionId != null) {
            rows = assessmentRepository
                    .findByClassIdAndSectionIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
                            classId, sectionId, academicYearId);
        } else if (classId != null) {
            rows = assessmentRepository
                    .findByClassIdAndAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(
                            classId, academicYearId);
        } else {
            rows = assessmentRepository
                    .findByAcademicYearIdAndDeletedAtIsNullOrderByTestDateDesc(academicYearId);
        }

        List<StudentAssessmentView> out = new ArrayList<>();
        for (OtherAssessment a : rows) {
            OtherAssessment.StudentEntry mine = null;
            if (a.getStudents() != null) {
                for (var s : a.getStudents()) {
                    if (studentId.equals(s.getStudentId())) { mine = s; break; }
                }
            }
            if (mine == null) continue;
            out.add(new StudentAssessmentView(a, mine));
        }
        return out;
    }

    /** Compact per-student projection of an assessment — only the
     *  caller's own marks are exposed. */
    public static class StudentAssessmentView {
        public String assessmentId;
        public String name;
        public String type;
        public java.time.LocalDate testDate;
        public List<OtherAssessment.SubjectSpec> subjects;
        public List<OtherAssessment.SubjectMark> myMarks;
        public String remark;
        /** Standard rank within the class (1-based). Null when the
         *  student has no marks entered yet. */
        public Integer myRank;
        /** Total number of students on the assessment with at least
         *  one mark entered — feeds a "Rank 3 of 40" label. */
        public Integer rankedCount;

        public StudentAssessmentView(OtherAssessment a, OtherAssessment.StudentEntry mine) {
            this.assessmentId = a.getAssessmentId();
            this.name = a.getName();
            this.type = a.getType();
            this.testDate = a.getTestDate();
            this.subjects = a.getSubjects();
            this.myMarks = mine.getSubjects();
            this.remark = mine.getRemark();
            this.myRank = mine.getRank();
            int ranked = 0;
            if (a.getStudents() != null) {
                for (var s : a.getStudents()) {
                    if (s.getRank() != null) ranked++;
                }
            }
            this.rankedCount = ranked;
        }
    }

    /** Un-archive a soft-deleted assessment — clears {@code deletedAt}
     *  so it reappears in the live admin list. Audit-logged so a
     *  restore can be traced back. */
    public OtherAssessment restore(String assessmentId, String userId) {
        OtherAssessment doc = get(assessmentId);
        if (doc.getDeletedAt() == null) {
            throw new BusinessException("Assessment is not archived.");
        }
        doc.setDeletedAt(null);
        doc.setDeletedBy(null);
        doc.setUpdatedBy(userId);
        OtherAssessment saved = assessmentRepository.save(doc);
        auditService.log("OTHER_ASSESSMENT_RESTORE", "OtherAssessment", assessmentId,
                "Restored " + saved.getName() + " by " + userId);
        return saved;
    }

    public OtherAssessment get(String assessmentId) {
        return assessmentRepository.findById(assessmentId)
                .orElseThrow(() -> new ResourceNotFoundException("OtherAssessment", assessmentId));
    }

    /**
     * Full replace of the {@code students[]} array on the doc. The
     * frontend loads the doc, edits marks locally, and posts back the
     * complete list — matches the spreadsheet mental model without a
     * diff protocol.
     *
     * <p>Marks are validated against each subject's {@code maxMarks};
     * a value above the cap or below zero surfaces a
     * {@link BusinessException} so the admin sees a clear message.
     * Nulls (blank cells) are preserved.</p>
     */
    public OtherAssessment saveMarks(String assessmentId, SaveMarksRequest req, String userId) {
        OtherAssessment doc = get(assessmentId);
        if (req == null || req.getStudents() == null) {
            throw new BusinessException("students payload is required.");
        }

        Map<String, Integer> maxBySubject = new HashMap<>();
        for (var s : doc.getSubjects()) {
            if (s.getMaxMarks() != null) maxBySubject.put(s.getSubjectId(), s.getMaxMarks());
        }

        // Carry admission numbers forward from the existing doc — the
        // save payload doesn't ship them, so a naive rebuild would
        // strip the snapshot we rely on for bulk-upload matching.
        Map<String, String> admissionByStudent = new HashMap<>();
        if (doc.getStudents() != null) {
            for (var s : doc.getStudents()) {
                if (s.getStudentId() != null && s.getAdmissionNumber() != null) {
                    admissionByStudent.put(s.getStudentId(), s.getAdmissionNumber());
                }
            }
        }

        List<OtherAssessment.StudentEntry> nextStudents = new ArrayList<>();
        for (var sIn : req.getStudents()) {
            OtherAssessment.StudentEntry entry = new OtherAssessment.StudentEntry(
                    sIn.getStudentId(), sIn.getRollNumber(), sIn.getFullName());
            entry.setAdmissionNumber(admissionByStudent.get(sIn.getStudentId()));
            entry.setRemark(sIn.getRemark());

            List<OtherAssessment.SubjectMark> marks = new ArrayList<>();
            if (sIn.getSubjects() != null) {
                for (var mIn : sIn.getSubjects()) {
                    Double val = mIn.getMarksObtained();
                    Integer max = maxBySubject.get(mIn.getSubjectId());
                    if (val != null) {
                        if (val < 0) {
                            throw new BusinessException(
                                    "Marks cannot be negative (subject " + mIn.getSubjectId() + ").");
                        }
                        if (max != null && val > max) {
                            throw new BusinessException(
                                    "Marks (" + val + ") exceed max (" + max
                                            + ") for subject " + mIn.getSubjectId() + ".");
                        }
                    }
                    OtherAssessment.SubjectMark sm = new OtherAssessment.SubjectMark(mIn.getSubjectId(), val);
                    sm.setRemark(mIn.getRemark());
                    marks.add(sm);
                }
            }
            entry.setSubjects(marks);
            nextStudents.add(entry);
        }

        // Ranking — computed on every save so the class list stays in
        // sync with whatever the admin just entered. Standard rank
        // (1, 2, 2, 4) by total marks obtained; students with no marks
        // entered stay unranked (null).
        computeRanks(nextStudents);

        doc.setStudents(nextStudents);
        doc.setUpdatedBy(userId);
        OtherAssessment saved = assessmentRepository.save(doc);
        auditService.log("OTHER_ASSESSMENT_SAVE_MARKS", "OtherAssessment", assessmentId,
                "Marks saved: " + nextStudents.size() + " students");
        return saved;
    }

    /**
     * Rank the class by total marks obtained across all subjects using
     * standard competition ranking — ties share a rank and the next
     * rank skips ("1, 2, 2, 4"). Students with no non-null marks stay
     * unranked (null) so a blank row doesn't sit at position N with an
     * apparent last-place rank.
     *
     * <p>Mutates the input list's {@link OtherAssessment.StudentEntry#rank}
     * in place — callers pass in the freshly-built next-state list.</p>
     */
    private void computeRanks(List<OtherAssessment.StudentEntry> students) {
        if (students == null || students.isEmpty()) return;

        // Snapshot totals separately so the sort we do here doesn't
        // reorder the roster the admin sees on the marks-entry table.
        record Row(OtherAssessment.StudentEntry entry, boolean hasAny, double total) {}
        List<Row> rows = new ArrayList<>(students.size());
        for (var s : students) {
            double total = 0d;
            boolean any = false;
            if (s.getSubjects() != null) {
                for (var m : s.getSubjects()) {
                    if (m.getMarksObtained() != null) {
                        total += m.getMarksObtained();
                        any = true;
                    }
                }
            }
            // Reset before ranking so a re-save with cleared marks
            // strips a previous rank cleanly.
            s.setRank(null);
            rows.add(new Row(s, any, total));
        }

        rows.sort((a, b) -> Double.compare(b.total, a.total));

        int position = 0;                // 1-based counter
        int currentRank = 0;
        Double lastTotal = null;
        for (Row r : rows) {
            if (!r.hasAny) continue;     // blank rows stay unranked
            position++;
            if (lastTotal == null || Double.compare(r.total, lastTotal) != 0) {
                currentRank = position;  // standard ranking — skip ties
                lastTotal = r.total;
            }
            r.entry.setRank(currentRank);
        }
    }

    /**
     * Edit the date and subject list of an existing assessment.
     * Subject rules:
     * <ul>
     *   <li>Remove: only allowed for subjects with ZERO marks entered
     *       across every student. Guarded so an admin doesn't erase
     *       parents' visible marks by mistake.</li>
     *   <li>Add: appended to the subject list; a blank
     *       {@link OtherAssessment.SubjectMark} row is seeded on every
     *       student so the marks-entry table lands ready.</li>
     *   <li>Keep: max marks may change freely; historical marks stay
     *       attached to the same subjectId.</li>
     * </ul>
     */
    public OtherAssessment update(String assessmentId, UpdateOtherAssessmentRequest req, String userId) {
        OtherAssessment doc = get(assessmentId);
        if (req == null) throw new BusinessException("Update payload is required.");

        // Update date if supplied.
        if (req.getTestDate() != null) doc.setTestDate(req.getTestDate());

        // Reconcile subject list — old vs new by subjectId.
        if (req.getSubjects() != null) {
            List<CreateOtherAssessmentRequest.SubjectInput> incoming = req.getSubjects();
            for (var s : incoming) {
                if (s.getSubjectId() == null || s.getSubjectId().isBlank()) {
                    throw new BusinessException("Every subject needs a subjectId.");
                }
                if (s.getMaxMarks() == null || s.getMaxMarks() <= 0) {
                    throw new BusinessException("Max marks must be positive.");
                }
            }

            Set<String> incomingIds = new HashSet<>();
            for (var s : incoming) incomingIds.add(s.getSubjectId());

            // 1) Removals — reject if the subject has any student mark.
            List<OtherAssessment.SubjectSpec> oldSubjects = doc.getSubjects() == null
                    ? List.of() : doc.getSubjects();
            for (var old : oldSubjects) {
                if (!incomingIds.contains(old.getSubjectId())
                        && hasAnyMarks(doc, old.getSubjectId())) {
                    throw new BusinessException(
                            "Cannot remove '" + old.getSubjectName()
                                    + "' — marks are already entered for at least one student.");
                }
            }

            // 2) Rebuild the doc's subject list from the incoming shape.
            List<OtherAssessment.SubjectSpec> nextSubjects = new ArrayList<>();
            for (var s : incoming) {
                nextSubjects.add(new OtherAssessment.SubjectSpec(
                        s.getSubjectId(), s.getSubjectName(), s.getMaxMarks()));
            }
            doc.setSubjects(nextSubjects);

            // 3) For each student, keep marks for subjects still in the
            //    list and append blank rows for newly-added subjects.
            //    Existing entries are matched by subjectId; anything
            //    that dropped out of the incoming list is discarded (we
            //    already asserted those had no marks above).
            if (doc.getStudents() != null) {
                for (var student : doc.getStudents()) {
                    Map<String, OtherAssessment.SubjectMark> byId = new HashMap<>();
                    if (student.getSubjects() != null) {
                        for (var m : student.getSubjects()) byId.put(m.getSubjectId(), m);
                    }
                    List<OtherAssessment.SubjectMark> nextMarks = new ArrayList<>();
                    for (var spec : nextSubjects) {
                        OtherAssessment.SubjectMark existing = byId.get(spec.getSubjectId());
                        nextMarks.add(existing != null ? existing
                                : new OtherAssessment.SubjectMark(spec.getSubjectId(), null));
                    }
                    student.setSubjects(nextMarks);
                }
            }
        }

        doc.setUpdatedBy(userId);
        OtherAssessment saved = assessmentRepository.save(doc);
        auditService.log("OTHER_ASSESSMENT_UPDATE", "OtherAssessment", assessmentId,
                "Updated " + saved.getName() + " by " + userId);
        return saved;
    }

    /** True when any student has a non-null mark for the given subject
     *  on this assessment. Drives the remove-subject guard and the
     *  soft-delete warning. */
    public boolean hasAnyMarks(OtherAssessment doc, String subjectId) {
        if (doc == null || doc.getStudents() == null) return false;
        for (var s : doc.getStudents()) {
            if (s.getSubjects() == null) continue;
            for (var m : s.getSubjects()) {
                if (subjectId != null && !subjectId.equals(m.getSubjectId())) continue;
                if (m.getMarksObtained() != null) return true;
            }
        }
        return false;
    }

    /** True when at least one student on the assessment has any mark
     *  entered. Used by the delete confirmation dialog to warn admins
     *  that they're about to hide data parents may already have seen. */
    public boolean hasAnyMarksEntered(String assessmentId) {
        return hasAnyMarks(get(assessmentId), null);
    }

    /**
     * Delete flow.
     * <ul>
     *   <li>{@code hard = false} (default) — soft delete. Sets
     *       {@code deletedAt} + {@code deletedBy}. The row disappears
     *       from the admin list but stays in the DB, so a later
     *       restore or audit can bring it back.</li>
     *   <li>{@code hard = true} — permanent removal from Mongo. Only
     *       admins with the confirmation should be able to trigger
     *       this from the UI.</li>
     * </ul>
     */
    public void delete(String assessmentId, boolean hard, String userId) {
        OtherAssessment doc = get(assessmentId);
        if (hard) {
            assessmentRepository.delete(doc);
            auditService.log("OTHER_ASSESSMENT_HARD_DELETE", "OtherAssessment", assessmentId,
                    "Permanent delete of " + doc.getName() + " by " + userId);
            return;
        }
        doc.setDeletedAt(Instant.now());
        doc.setDeletedBy(userId);
        assessmentRepository.save(doc);
        auditService.log("OTHER_ASSESSMENT_ARCHIVE", "OtherAssessment", assessmentId,
                "Archived " + doc.getName() + " by " + userId);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private void validate(CreateOtherAssessmentRequest req) {
        if (req.getSubjects() == null || req.getSubjects().isEmpty()) {
            throw new BusinessException("At least one subject is required.");
        }
        for (var s : req.getSubjects()) {
            if (s.getSubjectId() == null || s.getSubjectId().isBlank()) {
                throw new BusinessException("Every subject needs a subjectId.");
            }
            if (s.getMaxMarks() == null || s.getMaxMarks() <= 0) {
                throw new BusinessException("Max marks must be positive.");
            }
        }
    }

    private String fullName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last = s.getLastName() == null ? "" : s.getLastName().trim();
        String joined = (first + " " + last).trim();
        if (!joined.isEmpty()) return joined;
        if (s.getAdmissionNumber() != null && !s.getAdmissionNumber().isBlank()) {
            return s.getAdmissionNumber();
        }
        return s.getStudentId();
    }
}
