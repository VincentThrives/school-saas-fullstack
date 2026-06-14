package com.saas.school.modules.exam.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.exam.dto.BulkCreateExamRequest;
import com.saas.school.modules.exam.dto.BulkCreateExamResponse;
import com.saas.school.modules.exam.dto.EnterMarksRequest;
import com.saas.school.modules.exam.dto.ExamConfigDetail;
import com.saas.school.modules.exam.dto.ExamConfigSummary;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExamService {

    @Autowired private ExamRepository examRepository;
    @Autowired private ExamMarkRepository markRepository;
    @Autowired private StudentAssessmentsRepository assessmentsRepository;
    @Autowired private AuditService auditService;
    @Autowired private com.saas.school.modules.student.repository.StudentRepository studentRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;

    public Exam createExam(Exam req) {
        if (req.getSubjectId() == null || req.getSubjectId().isEmpty()) {
            throw new IllegalArgumentException("Subject is required");
        }
        if (req.getClassId() == null || req.getClassId().isEmpty()) {
            throw new IllegalArgumentException("Class is required");
        }
        validateComponent(req);
        // Max/pass marks are now owned by the EXAM itself, not snapped to
        // Subject.Component caps. Schools commonly run UT1 at 40+10 and Final
        // at 80+20 against the same Math subject — forcing exam marks to
        // match subject caps blocks that, so we trust the request's values.
        req.setExamId(UUID.randomUUID().toString());
        req.setStatus(Exam.ExamStatus.SCHEDULED);
        return examRepository.save(req);
    }

    /**
     * Validates the exam's {@code componentKey} against the parent
     * subject's component list.
     *
     * <p>Rules:
     * <ul>
     *   <li>Combined-mode exams (components[] non-empty) skip the
     *       componentKey check — components are listed explicitly inside
     *       the doc; we only verify each key resolves to a real component
     *       on the subject.</li>
     *   <li>For per-component exams: if the subject has a single
     *       component, {@code componentKey} is auto-filled from that
     *       component (so older clients which don't send the field still
     *       work).</li>
     *   <li>If the subject has multiple components, the request MUST
     *       carry a {@code componentKey} that resolves to an existing
     *       component.</li>
     * </ul>
     *
     * <p>Both EXAM and INTERNAL mode components are now exam-eligible.
     * Internal Assessment marks now flow through the same exam mark-entry
     * page as regular exam marks (the separate Internal Marks page is
     * legacy, kept for old data only).
     */
    private void validateComponent(Exam req) {
        Subject subject = subjectRepository.findById(req.getSubjectId()).orElse(null);
        if (subject == null) {
            // Subject not found — let downstream code surface the resource error.
            // We don't want to mask the real cause with a component-key complaint.
            return;
        }
        List<Subject.Component> comps = subject.getComponents();
        if (comps == null || comps.isEmpty()) {
            throw new IllegalArgumentException(
                    "Subject '" + subject.getName() + "' has no components configured.");
        }

        // Combined-mode exam: validate every listed component resolves.
        if (req.getComponents() != null && !req.getComponents().isEmpty()) {
            for (Exam.ExamComponent ec : req.getComponents()) {
                if (ec == null || ec.getKey() == null || ec.getKey().isBlank()) {
                    throw new IllegalArgumentException(
                            "Each combined-mode component must have a key.");
                }
                if (subject.componentByKey(ec.getKey()) == null) {
                    throw new IllegalArgumentException(
                            "Component '" + ec.getKey() + "' does not exist on subject '"
                                    + subject.getName() + "'.");
                }
            }
            return;
        }

        // Per-component exam: caller supplied a key → validate it directly.
        if (req.getComponentKey() != null && !req.getComponentKey().isBlank()) {
            Subject.Component target = subject.componentByKey(req.getComponentKey());
            if (target == null) {
                throw new IllegalArgumentException(
                        "Component '" + req.getComponentKey() + "' does not exist on subject '"
                                + subject.getName() + "'.");
            }
            return;
        }

        // No key supplied — auto-pick when there's only one component overall.
        // For multi-component subjects, force the caller to pick.
        if (comps.size() == 1) {
            req.setComponentKey(comps.get(0).getKey());
            return;
        }
        String labels = comps.stream()
                .map(Subject.Component::getLabel)
                .collect(java.util.stream.Collectors.joining(", "));
        throw new IllegalArgumentException(
                "Subject '" + subject.getName() + "' has multiple components ("
                        + labels + "). Pick which one this exam is for.");
    }

    public Exam getExamById(String examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
    }

    public Exam updateExam(String examId, Exam req) {
        Exam exam = getExamById(examId);
        if (exam.isMarksLocked()) {
            throw new BusinessException("Cannot edit exam — marks are locked.");
        }
        // Re-validate component if the subject (or component) is being changed.
        if (req.getSubjectId() != null && !req.getSubjectId().isBlank()) {
            validateComponent(req);
        }
        req.setExamId(examId);
        req.setStatus(exam.getStatus());
        req.setMarksLocked(exam.isMarksLocked());
        return examRepository.save(req);
    }

    public void deleteExam(String examId) {
        Exam exam = getExamById(examId);
        if (exam.isMarksLocked()) {
            throw new BusinessException("Cannot delete exam — marks are locked.");
        }
        examRepository.deleteById(examId);
        // Also delete batch assessment
        assessmentsRepository.findByExamId(examId).ifPresent(a -> assessmentsRepository.delete(a));
        auditService.log("DELETE_EXAM", "Exam", examId, "Exam deleted: " + exam.getName());
    }

    public List<Exam> listExams(String classId, String academicYearId) {
        if (classId != null && !classId.isBlank() && academicYearId != null && !academicYearId.isBlank()) {
            return examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        }
        return examRepository.findAll();
    }

    // ── NEW: Batch marks entry (1 document per exam) ──

    public StudentAssessments enterBatchMarks(EnterMarksRequest req, String teacherId) {
        Exam exam = examRepository.findById(req.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        if (exam.isMarksLocked()) {
            throw new BusinessException("Marks are locked for this exam. Contact school admin.");
        }

        // Upsert batch document
        StudentAssessments assessment = assessmentsRepository.findByExamId(exam.getExamId())
                .orElseGet(() -> {
                    StudentAssessments a = new StudentAssessments();
                    a.setId(UUID.randomUUID().toString());
                    a.setExamId(exam.getExamId());
                    a.setAcademicYearId(exam.getAcademicYearId());
                    a.setClassId(exam.getClassId());
                    a.setSectionId(exam.getSectionId());
                    a.setSubjectId(exam.getSubjectId());
                    return a;
                });

        assessment.setTeacherId(teacherId);

        boolean combined = exam.getComponents() != null && !exam.getComponents().isEmpty();

        // Build entries
        List<StudentAssessments.MarkEntry> entries = new ArrayList<>();
        for (var e : req.getMarks()) {
            if (combined) {
                entries.add(buildCombinedEntry(exam, e));
            } else {
                entries.add(buildPerComponentEntry(exam, e));
            }
        }
        assessment.setEntries(entries);

        assessmentsRepository.save(assessment);
        auditService.log("ENTER_MARKS", "StudentAssessments", assessment.getId(),
                "Batch marks entered for " + entries.size() + " students, exam: " + exam.getName());
        return assessment;
    }

    /**
     * Build a mark entry for a combined-mode exam. The request carries a
     * per-component marks map; we validate each cell against its own component
     * max, then write the map back AND populate aggregate fields (sum,
     * isPassed, grade) so legacy readers still get usable values.
     *
     * <p>Subject pass rule:
     * <ul>
     *   <li>PER_COMPONENT (default) — student passes iff every component met
     *       its own pass cap.</li>
     *   <li>COMBINED — student passes iff total obtained ≥ sum of pass caps.</li>
     * </ul>
     */
    private StudentAssessments.MarkEntry buildCombinedEntry(Exam exam, EnterMarksRequest.MarkEntry e) {
        Map<String, Double> inMap = e.getComponentMarks() == null
                ? Collections.emptyMap() : e.getComponentMarks();
        Map<String, Double> outMap = new java.util.LinkedHashMap<>();
        double total = 0;
        int totalMax = 0;
        int totalPass = 0;
        boolean allComponentsPassed = true;

        for (Exam.ExamComponent ec : exam.getComponents()) {
            int maxMarks = ec.getMaxMarks() == null ? 0 : ec.getMaxMarks();
            int passMarks = ec.getPassingMarks() == null ? 0 : ec.getPassingMarks();
            Double obtained = inMap.get(ec.getKey());
            if (obtained == null) {
                // Component left blank for this student — record nothing, don't
                // fabricate a 0 (matches per-component-mode behavior of "skip
                // students with null marks").
                allComponentsPassed = false;
                totalMax += maxMarks;
                totalPass += passMarks;
                continue;
            }
            if (obtained < 0 || obtained > maxMarks) {
                throw new BusinessException(
                        "Marks for component '" + ec.getLabel() + "' must be between 0 and " + maxMarks);
            }
            outMap.put(ec.getKey(), obtained);
            total += obtained;
            totalMax += maxMarks;
            totalPass += passMarks;
            if (obtained < passMarks) allComponentsPassed = false;
        }

        // Default pass rule = PER_COMPONENT (CBSE/ICSE style). Without
        // loading the Subject doc here we approximate; the report card
        // aggregator does the authoritative per-subject roll-up.
        boolean passed = allComponentsPassed;
        String grade = totalMax > 0 ? computeGrade(total, totalMax) : "-";

        StudentAssessments.MarkEntry entry = new StudentAssessments.MarkEntry(
                e.getStudentId(), total, grade, e.getRemarks(), passed);
        entry.setComponentMarks(outMap);
        return entry;
    }

    /**
     * Per-component (legacy) mark entry: one obtained number against the
     * exam's single max/pass. Kept identical to pre-combined-mode behaviour
     * so existing exams keep working without change.
     */
    private StudentAssessments.MarkEntry buildPerComponentEntry(Exam exam, EnterMarksRequest.MarkEntry e) {
        if (e.getMarksObtained() == null) {
            throw new BusinessException("Marks are required for student " + e.getStudentId());
        }
        // Use the SUM across all components for combined-mode exams.
        // The legacy scalar getMaxMarks() returns only the first
        // component's max (e.g. 80 on a Theory 80 + IA 20 = 100 exam),
        // so a student with 85 total would have been wrongly rejected
        // here. getEffectiveMaxMarks falls back to the scalar for
        // single-component exams, so the validation is identical there.
        int effMax = exam.getEffectiveMaxMarks();
        int effPass = exam.getEffectivePassingMarks();
        if (e.getMarksObtained() < 0 || e.getMarksObtained() > effMax) {
            throw new BusinessException("Marks must be between 0 and " + effMax);
        }
        boolean passed = e.getMarksObtained() >= effPass;
        String grade = computeGrade(e.getMarksObtained(), effMax);
        return new StudentAssessments.MarkEntry(
                e.getStudentId(), e.getMarksObtained(), grade, e.getRemarks(), passed);
    }

    // ── Get marks for an exam (from batch) ──

    public List<StudentAssessments.MarkEntry> getBatchMarks(String examId) {
        return assessmentsRepository.findByExamId(examId)
                .map(StudentAssessments::getEntries)
                .orElse(Collections.emptyList());
    }

    // ── Results from batch ──

    public Map<String, Object> getExamResults(String examId) {
        Exam exam = getExamById(examId);

        // Try batch first
        Optional<StudentAssessments> batchOpt = assessmentsRepository.findByExamId(examId);
        List<StudentAssessments.MarkEntry> entries;

        if (batchOpt.isPresent() && batchOpt.get().getEntries() != null && !batchOpt.get().getEntries().isEmpty()) {
            entries = batchOpt.get().getEntries();
        } else {
            // Fallback to old model
            List<ExamMark> oldMarks = markRepository.findByExamId(examId);
            entries = oldMarks.stream().map(m -> new StudentAssessments.MarkEntry(
                    m.getStudentId(), m.getMarksObtained(), m.getGrade(), m.getRemarks(), m.isPassed()
            )).toList();
        }

        int total = entries.size();
        long passed = entries.stream().filter(StudentAssessments.MarkEntry::isPassed).count();
        long failed = total - passed;
        double passPercent = total > 0 ? Math.round(passed * 1000.0 / total) / 10.0 : 0;
        double avg = total > 0 ? Math.round(entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).average().orElse(0) * 10.0) / 10.0 : 0;
        double highest = entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).max().orElse(0);
        double lowest = entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).min().orElse(0);

        Map<String, Long> gradeDist = entries.stream()
                .collect(Collectors.groupingBy(e -> e.getGrade() != null ? e.getGrade() : "?", Collectors.counting()));

        List<Map<String, Object>> toppers = entries.stream()
                .sorted((a, b) -> Double.compare(b.getMarksObtained(), a.getMarksObtained()))
                .limit(5)
                .map(m -> {
                    Map<String, Object> t = new HashMap<>();
                    t.put("studentId", m.getStudentId());
                    t.put("marksObtained", m.getMarksObtained());
                    t.put("grade", m.getGrade());
                    // Effective max = sum of component maxes for combined
                    // exams (Theory + IA + …), avoiding the 108% bug
                    // produced by dividing 85 by the legacy 80.
                    t.put("percentage", Math.round(m.getMarksObtained() / (double) exam.getEffectiveMaxMarks() * 1000.0) / 10.0);
                    return t;
                }).toList();

        // Convert entries to allMarks format for frontend compat
        List<Map<String, Object>> allMarks = entries.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", e.getStudentId());
            m.put("marksObtained", e.getMarksObtained());
            m.put("grade", e.getGrade());
            m.put("remarks", e.getRemarks());
            m.put("isPassed", e.isPassed());
            return m;
        }).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("examId", examId);
        result.put("examName", exam.getName());
        result.put("className", exam.getClassName());
        result.put("subjectName", exam.getSubjectName());
        // Front-of-the-API response carries the EFFECTIVE max/pass so
        // the results page renders "85 / 100" not "85 / 80" on combined
        // exams. The frontend has its own getter that re-derives from
        // components if present, but stamping the right value here also
        // covers the SMS publisher and any direct API consumers.
        result.put("maxMarks", exam.getEffectiveMaxMarks());
        result.put("passingMarks", exam.getEffectivePassingMarks());
        result.put("totalStudents", total);
        result.put("passed", passed);
        result.put("failed", failed);
        result.put("passPercentage", passPercent);
        result.put("classAverage", avg);
        result.put("highestMarks", highest);
        result.put("lowestMarks", lowest);
        result.put("gradeDistribution", gradeDist);
        result.put("toppers", toppers);
        result.put("allMarks", allMarks);
        return result;
    }

    // ── Lock/Unlock ──

    public void lockMarks(String examId) {
        Exam exam = getExamById(examId);
        exam.setMarksLocked(true);
        examRepository.save(exam);
        auditService.log("LOCK_MARKS", "Exam", examId, "Marks locked for exam: " + exam.getName());
    }

    public void unlockMarks(String examId) {
        Exam exam = getExamById(examId);
        exam.setMarksLocked(false);
        examRepository.save(exam);
        auditService.log("UNLOCK_MARKS", "Exam", examId, "Marks unlocked for exam: " + exam.getName());
    }

    // ── Legacy ──

    public List<ExamMark> getStudentMarks(String studentIdOrUserId) {
        return getStudentMarks(studentIdOrUserId, null);
    }

    /**
     * Returns a unified list of marks for one student, drawn from BOTH the
     * legacy {@code ExamMark} collection and the newer batch
     * {@code StudentAssessments} collection.
     *
     * <p>The first arg may be either a Student._id (admin/teacher path) or a
     * User.userId (student-self path) — we try both so {@code /my-marks}
     * works even though the JWT principal is the user id.</p>
     *
     * <p>When {@code academicYearId} is non-null, only marks whose linked exam
     * belongs to that year are returned.</p>
     */
    public List<ExamMark> getStudentMarks(String studentIdOrUserId, String academicYearId) {
        if (studentIdOrUserId == null || studentIdOrUserId.isBlank()) return List.of();

        // Build the set of (legacy) studentIds that may match. Marks are keyed
        // by Student._id, but callers sometimes pass a User.userId — resolve
        // through the student record so both work.
        java.util.Set<String> ids = new java.util.HashSet<>();
        ids.add(studentIdOrUserId);
        studentRepository.findByUserIdAndDeletedAtIsNull(studentIdOrUserId)
                .ifPresent(s -> ids.add(s.getStudentId()));

        // Optional year filter: load every exam exactly once.
        java.util.function.Predicate<String> examInYear = examId -> {
            if (academicYearId == null || academicYearId.isBlank()) return true;
            return examRepository.findById(examId)
                    .map(e -> academicYearId.equals(e.getAcademicYearId()))
                    .orElse(false);
        };

        List<ExamMark> out = new java.util.ArrayList<>();

        // 1) Legacy ExamMark collection.
        for (String id : ids) {
            for (ExamMark m : markRepository.findByStudentId(id)) {
                if (examInYear.test(m.getExamId())) out.add(m);
            }
        }

        // 2) New batch StudentAssessments collection — synthesize ExamMark
        // rows so the response shape stays the same for the frontend.
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (ExamMark m : out) seen.add(m.getExamId() + "::" + m.getStudentId());

        for (StudentAssessments doc : assessmentsRepository.findAll()) {
            if (doc.getEntries() == null) continue;
            if (!examInYear.test(doc.getExamId())) continue;
            for (StudentAssessments.MarkEntry e : doc.getEntries()) {
                if (e == null || !ids.contains(e.getStudentId())) continue;
                String key = doc.getExamId() + "::" + e.getStudentId();
                if (seen.contains(key)) continue;
                seen.add(key);
                ExamMark m = new ExamMark();
                m.setExamId(doc.getExamId());
                m.setStudentId(e.getStudentId());
                m.setMarksObtained(e.getMarksObtained());
                m.setGrade(e.getGrade());
                m.setPassed(e.isPassed());
                out.add(m);
            }
        }
        return out;
    }

    // ── Bulk create (Exam Config page) ────────────────────────────────────

    /**
     * Fan a single Exam Config submission into individual Exam docs — one
     * per (class+section pair × subject config). Each subject config can be
     * COMBINED (one exam doc carrying all components) or PER-COMPONENT (N
     * exam docs, one per component).
     *
     * <p>Skips silently when:
     * <ul>
     *   <li>Subject not configured for the (classId, sectionId) — the bulk
     *       form doesn't enforce subject availability, so the backend
     *       quietly drops impossible combinations.</li>
     *   <li>An exam with the same (year, examType, classId, sectionId,
     *       subjectId, mode signature) already exists — admin must delete
     *       the existing one and re-run if they want fresh max/pass.</li>
     * </ul>
     */
    public BulkCreateExamResponse bulkCreate(BulkCreateExamRequest req) {
        if (req.getExamType() == null || req.getExamType().isBlank()) {
            throw new IllegalArgumentException("Exam type is required");
        }
        if (req.getAcademicYearId() == null || req.getAcademicYearId().isBlank()) {
            throw new IllegalArgumentException("Academic year is required");
        }
        if (req.getPairs() == null || req.getPairs().isEmpty()) {
            throw new IllegalArgumentException("Pick at least one class & section");
        }
        if (req.getSubjectConfigs() == null || req.getSubjectConfigs().isEmpty()) {
            throw new IllegalArgumentException("Pick at least one subject");
        }

        // Resolve class + section names once for stamping onto exam docs (the
        // legacy list view reads these labels straight off the doc).
        Map<String, String> classNameById = new HashMap<>();
        Map<String, String> sectionNameById = new HashMap<>();
        for (var p : req.getPairs()) {
            if (p == null || p.getClassId() == null) continue;
            SchoolClass cls = schoolClassRepository.findById(p.getClassId()).orElse(null);
            if (cls == null) continue;
            classNameById.put(p.getClassId(), cls.getName());
            if (cls.getSections() != null) {
                for (var sec : cls.getSections()) {
                    if (sec != null && sec.getSectionId() != null) {
                        sectionNameById.put(sec.getSectionId(), sec.getName());
                    }
                }
            }
        }

        int created = 0;
        int skippedDuplicate = 0;
        int skippedNotConfigured = 0;
        List<String> createdExamIds = new ArrayList<>();

        for (var pair : req.getPairs()) {
            if (pair == null || pair.getClassId() == null || pair.getSectionId() == null) continue;
            for (var sc : req.getSubjectConfigs()) {
                if (sc == null || sc.getSubjectId() == null) continue;
                Subject subject = subjectRepository.findById(sc.getSubjectId()).orElse(null);
                if (subject == null) { skippedNotConfigured++; continue; }

                // Subject must be assigned to (classId, sectionId).
                List<String> sectionsForClass = subject.sectionIdsForClass(pair.getClassId());
                if (!sectionsForClass.contains(pair.getSectionId())) {
                    skippedNotConfigured++;
                    continue;
                }

                List<BulkCreateExamRequest.ComponentConfig> compCfgs = sc.getComponents();
                if (compCfgs == null || compCfgs.isEmpty()) {
                    skippedNotConfigured++;
                    continue;
                }

                // Existing exams for this (year, type, class, section, subject).
                List<Exam> existing = examRepository
                        .findByAcademicYearIdAndExamTypeAndClassIdAndSectionIdAndSubjectId(
                                req.getAcademicYearId(), req.getExamType(),
                                pair.getClassId(), pair.getSectionId(), sc.getSubjectId());

                if (sc.isCombined() && compCfgs.size() > 1) {
                    // Combined mode: one exam doc holding all components.
                    boolean hasCombined = existing.stream()
                            .anyMatch(e -> e.getComponents() != null && !e.getComponents().isEmpty());
                    if (hasCombined) { skippedDuplicate++; continue; }

                    Exam exam = newExam(req, pair, subject, classNameById, sectionNameById);
                    List<Exam.ExamComponent> ecs = new ArrayList<>();
                    for (var cc : compCfgs) {
                        if (cc == null || cc.getKey() == null) continue;
                        ecs.add(new Exam.ExamComponent(
                                cc.getKey(), cc.getLabel(),
                                cc.getMaxMarks(), cc.getPassingMarks()));
                    }
                    exam.setComponents(ecs);
                    // Primary fields mirror first component for legacy readers
                    // (list view "Max" column, downstream code that hasn't
                    // learned about components[] yet).
                    var first = compCfgs.get(0);
                    exam.setComponentKey(first.getKey());
                    exam.setMaxMarks(first.getMaxMarks() == null ? 0 : first.getMaxMarks());
                    exam.setPassingMarks(first.getPassingMarks() == null ? 0 : first.getPassingMarks());
                    exam.setName(req.getExamType() + " — " + subject.getName());
                    Exam saved = examRepository.save(exam);
                    createdExamIds.add(saved.getExamId());
                    created++;
                } else {
                    // Per-component mode: one exam per component.
                    for (var cc : compCfgs) {
                        if (cc == null || cc.getKey() == null) continue;
                        boolean dup = existing.stream().anyMatch(e ->
                                (e.getComponents() == null || e.getComponents().isEmpty())
                                && cc.getKey().equals(e.getComponentKey()));
                        if (dup) { skippedDuplicate++; continue; }

                        Exam exam = newExam(req, pair, subject, classNameById, sectionNameById);
                        exam.setComponentKey(cc.getKey());
                        exam.setMaxMarks(cc.getMaxMarks() == null ? 0 : cc.getMaxMarks());
                        exam.setPassingMarks(cc.getPassingMarks() == null ? 0 : cc.getPassingMarks());
                        exam.setName(req.getExamType() + " — " + subject.getName()
                                + (compCfgs.size() > 1 ? " (" + cc.getLabel() + ")" : ""));
                        Exam saved = examRepository.save(exam);
                        createdExamIds.add(saved.getExamId());
                        created++;
                    }
                }
            }
        }

        auditService.log("BULK_CREATE_EXAMS", "Exam", req.getExamType(),
                "Created " + created + " exams via Exam Config (type=" + req.getExamType()
                + ", duplicates=" + skippedDuplicate
                + ", notConfigured=" + skippedNotConfigured + ")");

        return new BulkCreateExamResponse(created, skippedDuplicate, skippedNotConfigured, createdExamIds);
    }

    // ── Exam Config list / detail / delete (the View page) ───────────────

    /**
     * Roll up every exam doc into one row per (academicYearId, examType)
     * tuple. The Exam Config list page renders this directly — class +
     * subject counts plus a marks-entered indicator so the user knows
     * whether editing or deleting will lose data.
     */
    public List<ExamConfigSummary> listConfigs() {
        List<Exam> all = examRepository.findAll();
        // Group key: yearId::examType
        Map<String, List<Exam>> grouped = new java.util.LinkedHashMap<>();
        for (Exam e : all) {
            if (e.getExamType() == null || e.getExamType().isBlank()) continue;
            String key = (e.getAcademicYearId() == null ? "" : e.getAcademicYearId())
                    + "::" + e.getExamType();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }

        // Marks check: which of these exam ids have a StudentAssessments doc
        // with non-empty entries? Single bulk read instead of N round trips.
        Set<String> examIdsWithMarks = new HashSet<>();
        for (StudentAssessments doc : assessmentsRepository.findAll()) {
            if (doc.getEntries() != null && !doc.getEntries().isEmpty()) {
                examIdsWithMarks.add(doc.getExamId());
            }
        }

        List<ExamConfigSummary> out = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            List<Exam> exams = entry.getValue();
            ExamConfigSummary s = new ExamConfigSummary();
            s.setAcademicYearId(exams.get(0).getAcademicYearId());
            s.setExamType(exams.get(0).getExamType());
            s.setExamCount(exams.size());

            // Distinct class+section labels (e.g. "1st - A").
            java.util.LinkedHashSet<String> labels = new java.util.LinkedHashSet<>();
            java.util.LinkedHashSet<String> subjectNames = new java.util.LinkedHashSet<>();
            List<String> examIds = new ArrayList<>();
            int marksCount = 0;
            String earliestDate = null;
            for (Exam e : exams) {
                String cl = e.getClassName() != null ? e.getClassName() : e.getClassId();
                String sec = e.getSectionName() != null ? e.getSectionName() : e.getSectionId();
                labels.add(cl + " - " + sec);
                if (e.getSubjectName() != null) subjectNames.add(e.getSubjectName());
                examIds.add(e.getExamId());
                if (examIdsWithMarks.contains(e.getExamId())) marksCount++;
                if (e.getExamDate() != null) {
                    String d = e.getExamDate().toString();
                    if (earliestDate == null || d.compareTo(earliestDate) < 0) earliestDate = d;
                }
            }
            s.setClassSectionLabels(new ArrayList<>(labels));
            s.setSubjectNames(new ArrayList<>(subjectNames));
            s.setExamIds(examIds);
            s.setExamsWithMarks(marksCount);
            s.setExamDate(earliestDate);
            out.add(s);
        }
        return out;
    }

    /**
     * Pre-fill payload for the edit form — reconstructs the original
     * Exam Config submission from the existing Exam docs in this group.
     * Combined exams contribute their full components[] list; per-component
     * exams contribute one component each, grouped by subjectId.
     */
    public ExamConfigDetail getConfigDetail(String academicYearId, String examType) {
        List<Exam> exams = examRepository
                .findByAcademicYearIdAndExamType(academicYearId, examType);
        if (exams.isEmpty()) {
            throw new ResourceNotFoundException(
                    "No exams found for type='" + examType + "' in this academic year.");
        }

        ExamConfigDetail out = new ExamConfigDetail();
        out.setAcademicYearId(academicYearId);
        out.setExamType(examType);
        // Carry the first exam's schedule fields as a default (admin can
        // override on save). Different exams in the group may legitimately
        // have different dates after manual editing — we surface one.
        Exam sample = exams.get(0);
        out.setExamDate(sample.getExamDate());
        out.setStartTime(sample.getStartTime());
        out.setEndTime(sample.getEndTime());
        out.setDescription(sample.getDescription());

        // Distinct (classId, sectionId) pairs.
        java.util.LinkedHashMap<String, BulkCreateExamRequest.ClassSection> pairs =
                new java.util.LinkedHashMap<>();
        for (Exam e : exams) {
            if (e.getClassId() == null || e.getSectionId() == null) continue;
            String key = e.getClassId() + "::" + e.getSectionId();
            pairs.computeIfAbsent(key, k -> new BulkCreateExamRequest.ClassSection(
                    e.getClassId(), e.getSectionId()));
        }
        out.setPairs(new ArrayList<>(pairs.values()));

        // Subject configs: group exams by subjectId, then collapse to one
        // SubjectConfig per subject. Combined mode wins if any exam in the
        // group carries components[] (admin can flip the toggle on save).
        java.util.LinkedHashMap<String, BulkCreateExamRequest.SubjectConfig> bySubject =
                new java.util.LinkedHashMap<>();
        for (Exam e : exams) {
            if (e.getSubjectId() == null) continue;
            BulkCreateExamRequest.SubjectConfig sc = bySubject.get(e.getSubjectId());
            if (sc == null) {
                sc = new BulkCreateExamRequest.SubjectConfig();
                sc.setSubjectId(e.getSubjectId());
                sc.setCombined(false);
                sc.setComponents(new ArrayList<>());
                bySubject.put(e.getSubjectId(), sc);
            }
            if (e.getComponents() != null && !e.getComponents().isEmpty()) {
                sc.setCombined(true);
                // Replace components from this combined exam — last write wins,
                // safe because every combined exam for the same subject in the
                // same config carries the same component config.
                List<BulkCreateExamRequest.ComponentConfig> ccs = new ArrayList<>();
                for (Exam.ExamComponent ec : e.getComponents()) {
                    BulkCreateExamRequest.ComponentConfig cc = new BulkCreateExamRequest.ComponentConfig();
                    cc.setKey(ec.getKey());
                    cc.setLabel(ec.getLabel());
                    cc.setMaxMarks(ec.getMaxMarks());
                    cc.setPassingMarks(ec.getPassingMarks());
                    ccs.add(cc);
                }
                sc.setComponents(ccs);
            } else {
                // Per-component exam — accumulate one ComponentConfig per
                // distinct componentKey for this subject.
                boolean exists = sc.getComponents().stream()
                        .anyMatch(c -> java.util.Objects.equals(c.getKey(), e.getComponentKey()));
                if (!exists) {
                    BulkCreateExamRequest.ComponentConfig cc = new BulkCreateExamRequest.ComponentConfig();
                    cc.setKey(e.getComponentKey());
                    // Label fallback: prettify the key when we don't have a
                    // subject component label handy (Subject.componentByKey
                    // wouldn't help if subject doc was edited later).
                    cc.setLabel(prettifyKey(e.getComponentKey()));
                    cc.setMaxMarks(e.getMaxMarks());
                    cc.setPassingMarks(e.getPassingMarks());
                    sc.getComponents().add(cc);
                }
            }
        }
        out.setSubjectConfigs(new ArrayList<>(bySubject.values()));

        // Marks-status check — drives the warning popup the admin sees
        // before editing.
        Set<String> examIds = exams.stream().map(Exam::getExamId)
                .collect(Collectors.toSet());
        boolean anyMarks = assessmentsRepository.findByExamIdIn(new ArrayList<>(examIds))
                .stream()
                .anyMatch(a -> a.getEntries() != null && !a.getEntries().isEmpty());
        out.setAnyMarksEntered(anyMarks);
        return out;
    }

    /**
     * Delete every exam matching (year, examType) AND its student marks.
     * Used by both the Delete action on the Configs list AND the edit
     * save path (edit = delete-then-recreate so config changes apply
     * cleanly to a fresh slate).
     *
     * <p>Marks-locked exams are also wiped — caller already confirmed the
     * intent via the warning popup, and a partial deletion would leave
     * the config in a half-state that's harder to recover from than a
     * clean restart.
     */
    public Map<String, Object> deleteConfig(String academicYearId, String examType) {
        List<Exam> exams = examRepository
                .findByAcademicYearIdAndExamType(academicYearId, examType);
        int deletedExams = 0;
        int deletedMarkDocs = 0;
        for (Exam e : exams) {
            String id = e.getExamId();
            examRepository.deleteById(id);
            deletedExams++;
            var batchOpt = assessmentsRepository.findByExamId(id);
            if (batchOpt.isPresent()) {
                assessmentsRepository.delete(batchOpt.get());
                deletedMarkDocs++;
            }
            // Wipe any legacy ExamMark rows too (per-student records from
            // the old data model).
            List<ExamMark> legacy = markRepository.findByExamId(id);
            if (legacy != null && !legacy.isEmpty()) {
                markRepository.deleteAll(legacy);
            }
        }
        auditService.log("DELETE_EXAM_CONFIG", "Exam", examType,
                "Deleted exam config '" + examType + "' (" + deletedExams
                + " exams, " + deletedMarkDocs + " mark docs).");
        Map<String, Object> out = new HashMap<>();
        out.put("deletedExams", deletedExams);
        out.put("deletedMarkDocs", deletedMarkDocs);
        return out;
    }

    /** True when any exam in this config group has at least one mark entry. */
    public boolean hasMarksForConfig(String academicYearId, String examType) {
        List<Exam> exams = examRepository
                .findByAcademicYearIdAndExamType(academicYearId, examType);
        if (exams.isEmpty()) return false;
        List<String> ids = exams.stream().map(Exam::getExamId).toList();
        return assessmentsRepository.findByExamIdIn(ids).stream()
                .anyMatch(a -> a.getEntries() != null && !a.getEntries().isEmpty());
    }

    /** "internal_assessment" → "Internal Assessment"; "theory" → "Theory". */
    private String prettifyKey(String key) {
        if (key == null || key.isBlank()) return "Component";
        String[] parts = key.replace('_', ' ').replace('-', ' ').split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(p.charAt(0)));
            if (p.length() > 1) sb.append(p.substring(1));
        }
        return sb.toString();
    }

    private Exam newExam(BulkCreateExamRequest req, BulkCreateExamRequest.ClassSection pair,
                         Subject subject,
                         Map<String, String> classNameById,
                         Map<String, String> sectionNameById) {
        Exam exam = new Exam();
        exam.setExamId(UUID.randomUUID().toString());
        exam.setExamType(req.getExamType());
        exam.setAcademicYearId(req.getAcademicYearId());
        exam.setClassId(pair.getClassId());
        exam.setSectionId(pair.getSectionId());
        exam.setSubjectId(subject.getSubjectId());
        exam.setSubjectName(subject.getName());
        exam.setClassName(classNameById.getOrDefault(pair.getClassId(), ""));
        exam.setSectionName(sectionNameById.getOrDefault(pair.getSectionId(), ""));
        exam.setExamDate(req.getExamDate());
        exam.setStartTime(req.getStartTime());
        exam.setEndTime(req.getEndTime());
        exam.setDescription(req.getDescription());
        exam.setStatus(Exam.ExamStatus.SCHEDULED);
        return exam;
    }

    public List<Exam> getUpcomingExams() {
        return examRepository.findAll().stream()
            .filter(e -> e.getExamDate() != null)
            .sorted((a, b) -> a.getExamDate().compareTo(b.getExamDate()))
            .toList();
    }

    private String computeGrade(double marks, int max) {
        double pct = marks / max * 100;
        if (pct >= 90) return "A+";
        if (pct >= 80) return "A";
        if (pct >= 70) return "B+";
        if (pct >= 60) return "B";
        if (pct >= 50) return "C";
        if (pct >= 40) return "D";
        return "F";
    }
}
