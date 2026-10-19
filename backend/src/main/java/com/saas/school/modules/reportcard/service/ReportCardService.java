package com.saas.school.modules.reportcard.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.model.ComponentInternalMark;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.exam.repository.ComponentInternalMarkRepository;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import com.saas.school.modules.reportcard.model.ReportCard;
import com.saas.school.modules.reportcard.repository.ReportCardRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ReportCardService {

    private static final Logger logger = LoggerFactory.getLogger(ReportCardService.class);

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamMarkRepository examMarkRepository;

    @Autowired
    private StudentAssessmentsRepository assessmentsRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private ReportCardRepository reportCardRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private ComponentInternalMarkRepository internalMarkRepository;

    @Autowired
    private com.saas.school.modules.academicyear.repository.AcademicYearRepository academicYearRepository;

    @Autowired
    private com.saas.school.modules.settings.repository.SchoolSettingsRepository schoolSettingsRepository;

    /** True when the current tenant has turned ON the per-exam Publish
     *  gate in Settings → Exams. Default (and legacy / no-settings-row)
     *  is false, which bypasses the published filter entirely so results
     *  appear on reports as soon as marks are entered — matches the
     *  pre-publish-workflow behavior schools are used to. */
    private boolean isPublishWorkflowEnabled() {
        String tenantId = com.saas.school.config.mongodb.TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) return false;
        return schoolSettingsRepository.findByTenantId(tenantId)
                .map(s -> s.isExamPublishWorkflowEnabled())
                .orElse(false);
    }

    /**
     * Strip the subject suffix ("· Kannada", "— Math", "- Physics") from
     * an {@code exam.name} so sibling-subject rows collapse into the same
     * event name ("FA1 · Kannada" and "FA1 · Math" both become "FA1").
     * Mirrors {@code ExamService.examNamePrefix} — kept local here to
     * avoid a cross-service dependency on a private method, and defended
     * against legacy exams with no name (falls back to examType).
     */
    private String examNamePrefix(Exam e) {
        String name = e == null ? null : e.getName();
        if (name != null && !name.isBlank()) {
            int bestSep = -1;
            for (String sep : new String[] { " · ", " — ", " - " }) {
                int idx = name.indexOf(sep);
                if (idx > 0 && (bestSep < 0 || idx < bestSep)) bestSep = idx;
            }
            return (bestSep > 0 ? name.substring(0, bestSep) : name).trim();
        }
        return e == null ? "" : (e.getExamType() == null ? "" : e.getExamType());
    }

    public ReportCard generateReportCard(String studentId, String academicYearId, String examType) {
        return generateReportCard(studentId, academicYearId, examType, true);
    }

    /**
     * Generate a report card with control over whether the result is
     * persisted immediately.
     *
     * <p>The {@code persistImmediately} flag exists for the bulk path —
     * generating 50 report cards used to write each one twice (once in
     * this method, then again in the rank loop), turning a single
     * classroom request into 100 Mongo writes. Bulk callers now pass
     * {@code false} here, set ranks in memory, and {@code saveAll}
     * once at the end.</p>
     */
    public ReportCard generateReportCard(String studentId, String academicYearId, String examType,
                                          boolean persistImmediately) {
        logger.info("Generating report card for studentId={}, academicYearId={}, examType={}", studentId, academicYearId, examType);
        if (examType == null || examType.isBlank()) {
            throw new IllegalArgumentException("Exam type is required. Please select an exam type (e.g. Sem 1, Final) before generating a report card.");
        }

        Student student = studentRepository.findById(studentId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));

        // Get student name - from student directly or from linked user
        String studentName;
        if (student.getFirstName() != null && !student.getFirstName().isEmpty()) {
            studentName = student.getFirstName() + " " + (student.getLastName() != null ? student.getLastName() : "");
        } else if (student.getUserId() != null) {
            User user = userRepository.findById(student.getUserId()).orElse(null);
            studentName = user != null ? user.getFirstName() + " " + user.getLastName() : "Student " + student.getAdmissionNumber();
        } else {
            studentName = "Student " + (student.getAdmissionNumber() != null ? student.getAdmissionNumber() : studentId);
        }

        String className = "";
        String sectionName = "";
        String classId = student.getClassId();
        if (classId != null) {
            // Bulk path has the SchoolClass prefetched (identical for every
            // student in the sweep); only the single-student path pays the
            // round trip. Falls back to a direct findById if the prefetched
            // class doesn't match (e.g. a cross-class call).
            BulkPrefetch pf = BULK_PREFETCH.get();
            SchoolClass schoolClass = (pf != null && pf.schoolClass != null && classId.equals(pf.schoolClass.getClassId()))
                    ? pf.schoolClass
                    : schoolClassRepository.findById(classId).orElse(null);
            if (schoolClass != null) {
                className = schoolClass.getName();
                if (student.getSectionId() != null && schoolClass.getSections() != null) {
                    schoolClass.getSections().stream()
                        .filter(s -> student.getSectionId().equals(s.getSectionId()))
                        .findFirst()
                        .ifPresent(s -> { });
                    for (var sec : schoolClass.getSections()) {
                        if (student.getSectionId().equals(sec.getSectionId())) {
                            sectionName = sec.getName();
                            break;
                        }
                    }
                }
            }
        }

        // Fetch exams scoped to (student's class, student's section, year).
        // Section is part of the scope at the repo level so a 10-B student
        // never sees 10-A or 10-C's exams in their report card — the only
        // exams that matter here are the ones the teacher scheduled for
        // this student's own section.
        //
        // Bulk path pre-populates a ThreadLocal so we don't re-issue this
        // query 50× for a 50-student class (see generateBulkReportCards).
        // The prefetched list is still class-wide; we trim it to the
        // student's section here before filtering by exam name.
        final String studentSectionId = student.getSectionId();
        BulkPrefetch prefetch = BULK_PREFETCH.get();
        List<Exam> exams;
        if (prefetch != null) {
            exams = prefetch.examsByClassYear.stream()
                    .filter(e -> studentSectionId == null
                            || studentSectionId.isBlank()
                            || e.getSectionId() == null
                            || e.getSectionId().isBlank()
                            || studentSectionId.equals(e.getSectionId()))
                    .collect(Collectors.toList());
        } else if (studentSectionId != null && !studentSectionId.isBlank()) {
            exams = examRepository.findByClassIdAndSectionIdAndAcademicYearId(
                    classId, studentSectionId, academicYearId);
        } else {
            exams = examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        }

        // Publish-gate — only honor when the school turned it ON in
        // Settings → Exams. Schools that don't want the formal publish
        // step see every exam immediately (every exam is treated as
        // published). This is the default.
        if (isPublishWorkflowEnabled()) {
            exams = exams.stream().filter(Exam::isPublished).collect(Collectors.toList());
        }

        if (examType != null && !examType.isEmpty()) {
            // The {@code examType} parameter now carries the exam NAME prefix
            // ("FA1", "SA1" …) rather than the broad examType ("FA", "SA"),
            // so a report card for FA1 contains only FA1 marks and never
            // mixes in FA2's or UT1's rows. Legacy exams (no name) still
            // match through examNamePrefix()'s fallback to e.getExamType().
            final String target = examType;
            exams = exams.stream()
                    .filter(e -> target.equalsIgnoreCase(examNamePrefix(e)))
                    .collect(Collectors.toList());
        }
        List<String> examIds = exams.stream().map(Exam::getExamId).collect(Collectors.toList());

        // Build a map of examId -> Exam for lookup
        Map<String, Exam> examMap = new HashMap<>();
        for (Exam exam : exams) {
            examMap.put(exam.getExamId(), exam);
        }

        // Fetch marks — try StudentAssessments (batch) first, fallback to ExamMark (legacy)
        // Build a simple list of (examId, marksObtained) per student
        Map<String, Double> examMarksMap = new HashMap<>(); // examId -> marks obtained (aggregate for combined)
        // For combined-mode exams, also collect the per-component breakdown so
        // the aggregator can fill component rows on the report card without
        // re-reading the assessments collection.
        Map<String, Map<String, Double>> componentMarksByExamId = new HashMap<>();

        // Check batch marks (StudentAssessments). Bulk path re-uses
        // the prefetched list, filtered to the examIds for THIS student's
        // exam scope — the prefetch loaded by classId+year covers every
        // student's exams since they share that scope.
        List<StudentAssessments> batchList = (prefetch != null)
                ? prefetch.assessmentsByExamIds
                : assessmentsRepository.findByExamIdIn(examIds);
        // Track which exams this student was explicitly marked ABSENT in.
        // An absent entry still carries marksObtained=0 so without this
        // flag the subject renders as "0 / 50  F" instead of the correct
        // "Absent" chip.
        Set<String> absentExamIds = new HashSet<>();
        for (StudentAssessments batch : batchList) {
            if (batch.getEntries() == null) continue;
            for (StudentAssessments.MarkEntry entry : batch.getEntries()) {
                if (studentId.equals(entry.getStudentId())) {
                    examMarksMap.put(batch.getExamId(), entry.getMarksObtained() != null ? entry.getMarksObtained() : 0.0);
                    if (entry.getComponentMarks() != null && !entry.getComponentMarks().isEmpty()) {
                        componentMarksByExamId.put(batch.getExamId(), entry.getComponentMarks());
                    }
                    if (entry.getStatus() == StudentAssessments.AttendanceStatus.ABSENT) {
                        absentExamIds.add(batch.getExamId());
                    }
                }
            }
        }

        // Fallback to legacy ExamMark for exams not found in batch
        if (examMarksMap.isEmpty()) {
            List<ExamMark> marks = examMarkRepository.findByStudentIdAndExamIdIn(studentId, examIds);
            for (ExamMark mark : marks) {
                examMarksMap.putIfAbsent(mark.getExamId(), mark.getMarksObtained() != null ? mark.getMarksObtained() : 0.0);
            }
        }

        // Build the subject-name lookup from the real Subject collection
        // rather than a hardcoded list — every school configures its own
        // subjects, so a baked-in catalog would only mislead report cards
        // for any subject the school hasn't named after one of these
        // common Indian-board patterns.
        Map<String, String> allSubjects = new java.util.LinkedHashMap<>();
        // Subjects catalog is the same for every student in a tenant —
        // bulk path uses the prefetched list to avoid hitting Mongo 50×
        // for the identical findAll() result.
        List<Subject> subjectSource = (prefetch != null) ? prefetch.subjects : subjectRepository.findAll();
        for (Subject s : subjectSource) {
            if (s.getSubjectId() != null && s.getName() != null) {
                allSubjects.put(s.getSubjectId(), s.getName());
            }
        }

        // Aggregate marks per subject from exams
        Map<String, Double> subjectMarksObtained = new HashMap<>();
        Map<String, Double> subjectMaxMarks = new HashMap<>();
        Map<String, String> subjectNamesFromExams = new HashMap<>();
        // Track which subjects should be rendered "Absent" (a matching exam exists
        // for the selected type, but this student has no marks entry for it).
        Set<String> absentSubjectIds = new HashSet<>();

        boolean specificExamType = examType != null && !examType.isEmpty();

        if (specificExamType) {
            // ── One exam per subject rule ───────────────────────────
            // After scoping by (year, class, section, exam-name) there is at
            // most one exam per subject in this list — nothing to tiebreak.
            // The map is just a subjectId → Exam groupBy; a second exam for
            // the same subject would indicate stale data, which we log so
            // the admin can investigate (and still carry on with the first).
            Map<String, Exam> bestExamBySubject = new HashMap<>();
            for (Exam exam : exams) {
                String subjectId = exam.getSubjectId();
                if (subjectId == null) continue;
                Exam prior = bestExamBySubject.putIfAbsent(subjectId, exam);
                if (prior != null) {
                    logger.warn("ReportCard: more than one exam matched "
                            + "(year={}, class={}, section={}, subject={}, name={}). "
                            + "Keeping {} and ignoring {}. Clean this up in Exam Config.",
                            academicYearId, classId, studentSectionId, subjectId,
                            examType, prior.getExamId(), exam.getExamId());
                }
            }

            for (Map.Entry<String, Exam> e : bestExamBySubject.entrySet()) {
                String subjectId = e.getKey();
                Exam exam = e.getValue();
                String subjectName = allSubjects.getOrDefault(
                    subjectId, exam.getSubjectName() != null ? exam.getSubjectName() : subjectId);
                subjectNamesFromExams.put(subjectId, subjectName);

                // Effective max sums all components for combined-mode
                // exams (Theory + IA), so a 80/20 Math exam reads as a
                // 100-mark denominator instead of the legacy 80 that
                // pushed percentages over 100.
                subjectMaxMarks.put(subjectId, (double) exam.getEffectiveMaxMarks());
                Double obtained = examMarksMap.get(exam.getExamId());
                // Three states to distinguish:
                //  - no entry at all           → absent (not yet entered)
                //  - entry with status=ABSENT  → absent (teacher explicitly marked)
                //  - entry with real marks     → render those marks (even 0)
                if (obtained == null) {
                    subjectMarksObtained.put(subjectId, 0.0);
                    absentSubjectIds.add(subjectId);
                } else if (absentExamIds.contains(exam.getExamId())) {
                    // Teacher clicked the Absent toggle — the student
                    // sat for the slot but was absent. Flag so the
                    // subject row shows the Absent chip instead of
                    // "0 / 50  F", and the overall grade ignores it.
                    subjectMarksObtained.put(subjectId, 0.0);
                    absentSubjectIds.add(subjectId);
                } else {
                    subjectMarksObtained.put(subjectId, obtained);
                }
            }
        } else {
            // ── All Exam Types: cumulative across every exam (existing behavior) ──
            for (Map.Entry<String, Double> entry : examMarksMap.entrySet()) {
                Exam exam = examMap.get(entry.getKey());
                if (exam == null) continue;
                String subjectId = exam.getSubjectId();
                String subjectName = allSubjects.getOrDefault(subjectId, exam.getSubjectName() != null ? exam.getSubjectName() : subjectId);
                subjectNamesFromExams.putIfAbsent(subjectId, subjectName);
                subjectMarksObtained.merge(subjectId, entry.getValue(), Double::sum);
                // Same combined-exam fix as above — effective max
                // covers Theory + IA + … so the cumulative denominator
                // matches the cumulative obtained marks.
                subjectMaxMarks.merge(subjectId, (double) exam.getEffectiveMaxMarks(), Double::sum);
            }
        }

        // Build subject grades — include all subjects that have marks
        List<ReportCard.SubjectGrade> subjectGrades = new ArrayList<>();
        double totalMarks = 0;
        double totalMaxMarks = 0;

        // Use subjects from exams (not all standard subjects — only show subjects with data)
        Map<String, String> subjectNames = subjectNamesFromExams.isEmpty() ? allSubjects : subjectNamesFromExams;

        // Pre-fetch this student's internal marks once (for INTERNAL-mode components).
        // Spans the whole year — we filter per (subject, component) in the loop.
        List<ComponentInternalMark> allInternalMarks =
                internalMarkRepository.findByStudentIdAndAcademicYearId(studentId, academicYearId);

        for (String subjectId : subjectNames.keySet()) {
            double obtained = subjectMarksObtained.getOrDefault(subjectId, 0.0);
            double max = subjectMaxMarks.getOrDefault(subjectId, 0.0);
            boolean isAbsent = absentSubjectIds.contains(subjectId);

            // Bulk path has the whole subjects catalog as a hashmap, so
            // the per-subject lookup is O(1) instead of a Mongo round trip
            // per subject per student.
            Subject subject = (prefetch != null && prefetch.subjectById != null)
                    ? prefetch.subjectById.get(subjectId)
                    : subjectRepository.findById(subjectId).orElse(null);

            // Elective gate — when the subject is marked elective AND
            // its enrolledStudentIds list excludes this student, the
            // subject simply doesn't apply to them. Skip the row so
            // the report card doesn't render "Absent" for a Sanskrit
            // they never took. Non-electives, and electives with a
            // null / empty roster, fall through to the existing
            // logic so legacy report cards stay identical.
            if (subject != null
                    && subject.isElective()
                    && subject.getEnrolledStudentIds() != null
                    && !subject.getEnrolledStudentIds().isEmpty()
                    && !subject.getEnrolledStudentIds().contains(studentId)) {
                continue;
            }

            // Try to enrich with per-component breakdown. For component-shaped
            // subjects this also overrides obtained/max with the component sum,
            // so internal marks (which live outside the Exam table) get included
            // in the subject total.
            List<ReportCard.ComponentGrade> componentGrades = null;
            boolean subjectPassed = !isAbsent;
            if (subject != null && subject.getComponents() != null && !subject.getComponents().isEmpty()) {
                ComponentAggregate agg = aggregateComponents(
                        subject, studentId, academicYearId, exams,
                        examMarksMap, componentMarksByExamId, allInternalMarks);
                componentGrades = agg.componentGrades;
                obtained = agg.totalObtained;
                max = agg.totalMax;
                subjectPassed = !isAbsent && agg.subjectPassed;
            }

            double pct = max > 0 ? (obtained / max) * 100 : 0;
            String grade = isAbsent ? "—" : calculateGrade(pct);

            // Skip subjects with no configured max
            if (max <= 0) continue;

            ReportCard.SubjectGrade sg = new ReportCard.SubjectGrade();
            sg.setSubjectId(subjectId);
            // Use proper name from allSubjects map, fallback to exam name
            sg.setSubjectName(allSubjects.getOrDefault(subjectId, subjectNames.get(subjectId)));
            sg.setMarksObtained(obtained);
            sg.setMaxMarks(max);
            sg.setGrade(grade);
            sg.setAbsent(isAbsent);
            sg.setPassed(subjectPassed);
            sg.setComponents(componentGrades);
            subjectGrades.add(sg);

            totalMarks += obtained;
            totalMaxMarks += max;
        }

        // Add "Not Scheduled" rows for every subject on the student's own
        // (class, section) roster that didn't get an exam this period.
        // Keeps the report card visually complete — admins see every
        // subject with either marks, Absent, or Not Scheduled, instead
        // of a one-row card that looks like data is missing. These rows
        // DON'T contribute to totalMarks / totalMaxMarks (max = 0).
        if (studentSectionId != null && !studentSectionId.isBlank()) {
            Set<String> alreadyRendered = subjectGrades.stream()
                    .map(ReportCard.SubjectGrade::getSubjectId)
                    .collect(Collectors.toSet());
            // Bulk path has these prefetched (same for every student in
            // the sweep). Single-student path still hits the repo once.
            List<Subject> rosterSubjects = (prefetch != null && prefetch.classSubjects != null)
                    ? prefetch.classSubjects
                    : subjectRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
            for (Subject sub : rosterSubjects) {
                if (sub == null || sub.getSubjectId() == null) continue;
                if (alreadyRendered.contains(sub.getSubjectId())) continue;
                // Section-scoped: only subjects actually assigned to this
                // student's section count. (Elective + enrolledStudentIds
                // still gate per-student at the same place as above.)
                if (!sub.sectionIdsForClass(classId).contains(studentSectionId)) continue;
                if (sub.isElective()
                        && sub.getEnrolledStudentIds() != null
                        && !sub.getEnrolledStudentIds().isEmpty()
                        && !sub.getEnrolledStudentIds().contains(studentId)) {
                    continue;
                }
                ReportCard.SubjectGrade sg = new ReportCard.SubjectGrade();
                sg.setSubjectId(sub.getSubjectId());
                sg.setSubjectName(sub.getName());
                sg.setMarksObtained(0);
                sg.setMaxMarks(0);
                sg.setGrade("—");
                sg.setPassed(true);     // not fail — exam wasn't held
                sg.setAbsent(false);
                sg.setNotScheduled(true);
                subjectGrades.add(sg);
            }
        }

        double overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
        // No marks ENTERED yet → no grade. "Entered 0" is a valid real
        // score (shows F) and must stay distinct from "teacher hasn't
        // filled anything in". We check for at least one subject with an
        // actual entry (neither Absent nor Not-Scheduled) — that's the
        // signal that evaluation has started. If none, overall grade
        // reads "—" so an untouched section doesn't look like a mass
        // failure. Pass/Fail follows the same rule.
        boolean anyMarksEntered = subjectGrades.stream()
                .anyMatch(sg -> !sg.isAbsent() && !sg.isNotScheduled());
        String overallGrade = anyMarksEntered ? calculateGrade(overallPercentage) : "—";

        // Calculate attendance percentage
        double attendancePercentage = calculateAttendancePercentage(studentId, academicYearId);

        // Calculate rank among classmates. Bulk path discards this value
        // and re-ranks in-memory after the whole class is built, so skip
        // the (expensive) per-student findByClassIdAndAcademicYearId
        // query when we're inside a bulk sweep.
        int rank = (prefetch != null) ? 0 : calculateRank(studentId, classId, academicYearId, overallPercentage);

        // Build and save report card
        ReportCard reportCard = new ReportCard();
        reportCard.setStudentId(studentId);
        reportCard.setStudentName(studentName.trim());
        reportCard.setClassId(classId);
        reportCard.setClassName(className);
        reportCard.setAcademicYearId(academicYearId);
        // Fetch academic year label — reuse the bulk prefetch when it
        // matches, so a 50-student class makes one AY lookup, not 50.
        if (prefetch != null && prefetch.academicYear != null
                && academicYearId.equals(prefetch.academicYear.getAcademicYearId())) {
            reportCard.setAcademicYearLabel(prefetch.academicYear.getLabel());
        } else {
            academicYearRepository.findById(academicYearId).ifPresent(ay ->
                reportCard.setAcademicYearLabel(ay.getLabel())
            );
        }
        reportCard.setExamType(specificExamType ? examType : null);
        reportCard.setSubjects(subjectGrades);
        reportCard.setTotalMarks(totalMarks);
        reportCard.setTotalMaxMarks(totalMaxMarks);
        reportCard.setPercentage(Math.round(overallPercentage * 100.0) / 100.0);
        reportCard.setGrade(overallGrade);
        reportCard.setRank(rank);
        reportCard.setAttendancePercentage(Math.round(attendancePercentage * 100.0) / 100.0);
        // Overall pass = every subject passed. A single failed subject (e.g.
        // Practical below its per-component pass cap) flips the whole card
        // to FAIL, even if the aggregate percentage clears 35%.
        boolean allSubjectsPassed = !subjectGrades.isEmpty()
                && subjectGrades.stream().allMatch(ReportCard.SubjectGrade::isPassed);
        reportCard.setPassed(allSubjectsPassed);

        if (!persistImmediately) {
            // Bulk path will saveAll() once after ranks are computed.
            return reportCard;
        }
        ReportCard saved = reportCardRepository.save(reportCard);
        logger.info("Report card generated and saved for studentId={}, id={}", studentId, saved.getId());
        return saved;
    }

    public byte[] generateReportCardPdf(String reportCardId, String tenantId) {
        logger.info("Generating report card PDF for reportCardId={}, tenantId={}", reportCardId, tenantId);

        ReportCard reportCard = reportCardRepository.findById(reportCardId)
                .orElseThrow(() -> new ResourceNotFoundException("Report card not found with id: " + reportCardId));

        // Lookup tenant in CENTRAL DB (clear tenant context temporarily)
        String currentTenant = com.saas.school.config.mongodb.TenantContext.getTenantId();
        com.saas.school.config.mongodb.TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));
        // Restore tenant context
        if (currentTenant != null) {
            com.saas.school.config.mongodb.TenantContext.setTenantId(currentTenant);
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            pdfDoc.setDefaultPageSize(PageSize.A4);
            Document document = new Document(pdfDoc);
            // Compact margins to fit single page
            document.setMargins(20, 25, 15, 25);

            // ── School Logo Space ──
            document.add(new Paragraph("[School Logo]")
                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)
                    .setFontColor(ColorConstants.LIGHT_GRAY).setMarginBottom(2));

            // ── School Header ──
            document.add(new Paragraph(tenant.getSchoolName())
                    .setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));

            if (tenant.getAddress() != null) {
                StringBuilder addressStr = new StringBuilder();
                if (tenant.getAddress().getStreet() != null) addressStr.append(tenant.getAddress().getStreet()).append(", ");
                if (tenant.getAddress().getCity() != null) addressStr.append(tenant.getAddress().getCity()).append(", ");
                if (tenant.getAddress().getState() != null) addressStr.append(tenant.getAddress().getState());
                if (tenant.getAddress().getZip() != null) addressStr.append(" - ").append(tenant.getAddress().getZip());
                if (addressStr.length() > 0) {
                    document.add(new Paragraph(addressStr.toString())
                            .setFontSize(7).setTextAlignment(TextAlignment.CENTER)
                            .setFontColor(ColorConstants.GRAY).setMarginBottom(1));
                }
            }

            if (tenant.getContactPhone() != null) {
                document.add(new Paragraph("Ph: " + tenant.getContactPhone() + " | " + tenant.getContactEmail())
                        .setFontSize(7).setTextAlignment(TextAlignment.CENTER)
                        .setFontColor(ColorConstants.GRAY).setMarginBottom(2));
            }

            // ── Separator ──
            document.add(new Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    .setTextAlignment(TextAlignment.CENTER).setFontSize(6).setMarginBottom(2));

            document.add(new Paragraph("REPORT CARD")
                    .setBold().setFontSize(13).setTextAlignment(TextAlignment.CENTER).setMarginBottom(6));

            // ── Student Info ──
            Table infoTable = new Table(UnitValue.createPercentArray(new float[]{18, 32, 18, 32}));
            infoTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(6);

            // Fetch student for extra details
            Student studentForPdf = studentRepository.findById(reportCard.getStudentId()).orElse(null);
            String sectionNamePdf = "-";
            if (studentForPdf != null && studentForPdf.getClassId() != null) {
                SchoolClass cls = schoolClassRepository.findById(studentForPdf.getClassId()).orElse(null);
                if (cls != null && studentForPdf.getSectionId() != null && cls.getSections() != null) {
                    for (var sec : cls.getSections()) {
                        if (studentForPdf.getSectionId().equals(sec.getSectionId())) {
                            sectionNamePdf = sec.getName();
                            break;
                        }
                    }
                }
            }

            addCompactInfoCell(infoTable, "Student Name:", reportCard.getStudentName());
            addCompactInfoCell(infoTable, "Class:", reportCard.getClassName());
            addCompactInfoCell(infoTable, "Section:", sectionNamePdf);
            addCompactInfoCell(infoTable, "Adm. No:", studentForPdf != null && studentForPdf.getAdmissionNumber() != null ? studentForPdf.getAdmissionNumber() : "-");
            addCompactInfoCell(infoTable, "Roll No:", studentForPdf != null && studentForPdf.getRollNumber() != null ? studentForPdf.getRollNumber() : "-");
            addCompactInfoCell(infoTable, "Academic Year:", reportCard.getAcademicYearLabel() != null ? reportCard.getAcademicYearLabel() : reportCard.getAcademicYearId());
            addCompactInfoCell(infoTable, "DOB:", studentForPdf != null && studentForPdf.getDateOfBirth() != null ? studentForPdf.getDateOfBirth().toString() : "-");
            addCompactInfoCell(infoTable, "Rank:", String.valueOf(reportCard.getRank()));
            document.add(infoTable);

            // ── Marks Table ──
            //
            // One row PER subject. For hybrid subjects (Theory + Practical,
            // etc.) each component gets its own column instead of a separate
            // sub-row, so parents read a clean grid:
            //
            //   # | Subject | Theory | Practical | Marks | Max | Grade
            //   1 | English | 65/70  | 10/30 ✗   | 75    | 100 | B+   (FAIL)
            //
            // The Theory/Practical column set is derived from the UNION of
            // components across all subjects, preserving first-seen order.
            // Subjects that don't use a given component show "—".
            List<ReportCard.SubjectGrade> subjects = reportCard.getSubjects();
            List<String> componentLabels = new ArrayList<>();
            if (subjects != null) {
                for (ReportCard.SubjectGrade sg : subjects) {
                    if (sg.getComponents() == null) continue;
                    for (ReportCard.ComponentGrade cg : sg.getComponents()) {
                        if (cg.getLabel() != null && !componentLabels.contains(cg.getLabel())) {
                            componentLabels.add(cg.getLabel());
                        }
                    }
                }
            }

            // Width layout: # + Subject + N component cols + Marks + Max + Grade.
            // Numbers chosen so the table totals ~100 for 0–3 component columns
            // without crowding the trailing summary cells.
            int compCount = componentLabels.size();
            float[] widths = new float[5 + compCount];
            widths[0] = 6;                          // #
            widths[1] = compCount == 0 ? 32 : 24;   // Subject — wider when no comp cols
            for (int c = 0; c < compCount; c++) widths[2 + c] = 13;
            widths[2 + compCount]     = 12;         // Marks Obtained
            widths[3 + compCount]     = 10;         // Max Marks
            widths[4 + compCount]     = 10;         // Grade
            Table marksTable = new Table(UnitValue.createPercentArray(widths));
            marksTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);

            addCompactHeaderCell(marksTable, "#");
            addCompactHeaderCell(marksTable, "Subject");
            for (String lbl : componentLabels) addCompactHeaderCell(marksTable, lbl);
            addCompactHeaderCell(marksTable, "Marks Obtained");
            addCompactHeaderCell(marksTable, "Max Marks");
            addCompactHeaderCell(marksTable, "Grade");

            if (subjects != null) {
                // Light red tint on failed subject rows so parents see the
                // problem subject at a glance.
                DeviceRgb failTint = new DeviceRgb(252, 232, 232);
                for (int i = 0; i < subjects.size(); i++) {
                    ReportCard.SubjectGrade sg = subjects.get(i);
                    boolean subjectFailed = !sg.isPassed() && !sg.isAbsent();

                    // Subject name stays clean — Pass/Fail labels live in the
                    // component columns where the actual cause sits. The row
                    // tint still flags failed subjects at a glance.
                    Cell numC = new Cell().add(new Paragraph(String.valueOf(i + 1)).setFontSize(8)).setPadding(2);
                    Cell subC = new Cell().add(new Paragraph(sg.getSubjectName()).setBold().setFontSize(8)).setPadding(2);
                    if (subjectFailed) { numC.setBackgroundColor(failTint); subC.setBackgroundColor(failTint); }
                    marksTable.addCell(numC);
                    marksTable.addCell(subC);

                    // Index this subject's components by label for fast column lookup.
                    Map<String, ReportCard.ComponentGrade> compByLabel = new HashMap<>();
                    if (sg.getComponents() != null) {
                        for (ReportCard.ComponentGrade cg : sg.getComponents()) {
                            if (cg.getLabel() != null) compByLabel.put(cg.getLabel(), cg);
                        }
                    }
                    for (String lbl : componentLabels) {
                        ReportCard.ComponentGrade cg = compByLabel.get(lbl);
                        Cell c;
                        if (cg == null) {
                            // Subject doesn't have this component — show a dash.
                            c = new Cell().add(new Paragraph("—")
                                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                        } else {
                            // "65 / 70 (Pass)" or "10 / 30 (Fail)" — explicit
                            // verdict per component so parents see exactly which
                            // slice failed and which passed.
                            String verdict = cg.isPassed() ? "(Pass)" : "(Fail)";
                            String mark = trimDecimal(cg.getMarksObtained())
                                    + " / " + trimDecimal(cg.getMaxMarks())
                                    + "  " + verdict;
                            c = new Cell().add(new Paragraph(mark)
                                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                            if (!cg.isPassed()) c.setBackgroundColor(failTint);
                        }
                        // Tint passing or empty cells on a failed subject row
                        // too, so the whole row reads as the problem row.
                        if (subjectFailed && cg != null && cg.isPassed()) c.setBackgroundColor(failTint);
                        if (subjectFailed && cg == null) c.setBackgroundColor(failTint);
                        marksTable.addCell(c);
                    }

                    Cell obtC = new Cell().add(new Paragraph(trimDecimal(sg.getMarksObtained())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    Cell maxC = new Cell().add(new Paragraph(trimDecimal(sg.getMaxMarks())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    Cell grdC = new Cell().add(new Paragraph(sg.getGrade()).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    if (subjectFailed) {
                        obtC.setBackgroundColor(failTint);
                        maxC.setBackgroundColor(failTint);
                        grdC.setBackgroundColor(failTint);
                    }
                    marksTable.addCell(obtC);
                    marksTable.addCell(maxC);
                    marksTable.addCell(grdC);
                }
            }

            // Total row — TOTAL label spans # + Subject + every component column.
            int totalLabelSpan = 2 + compCount;
            marksTable.addCell(new Cell(1, totalLabelSpan).add(new Paragraph("TOTAL").setBold().setFontSize(8)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(trimDecimal(reportCard.getTotalMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(trimDecimal(reportCard.getTotalMaxMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(reportCard.getGrade()).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            document.add(marksTable);

            // ── Result Summary ──
            Table resultTable = new Table(UnitValue.createPercentArray(new float[]{25, 25, 25, 25}));
            resultTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);

            Cell pctLabel = new Cell().setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(3);
            pctLabel.add(new Paragraph("Percentage").setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            resultTable.addCell(pctLabel);
            resultTable.addCell(new Cell().add(new Paragraph(reportCard.getPercentage() + "%").setBold().setFontSize(10).setTextAlignment(TextAlignment.CENTER)).setPadding(3));

            Cell gradeLabel = new Cell().setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(3);
            gradeLabel.add(new Paragraph("Grade").setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            resultTable.addCell(gradeLabel);
            resultTable.addCell(new Cell().add(new Paragraph(reportCard.getGrade()).setBold().setFontSize(11).setTextAlignment(TextAlignment.CENTER)).setPadding(3));
            document.add(resultTable);

            // ── PASS / FAIL ──
            // Use the persisted per-subject roll-up rather than a flat
            // percentage threshold — a single failed subject (e.g. a
            // Practical below its component pass cap) flips the card to
            // FAIL even if the average looks healthy.
            String result = reportCard.isPassed() ? "PASS" : "FAIL";
            document.add(new Paragraph("Result: " + result)
                    .setBold().setFontSize(12).setTextAlignment(TextAlignment.CENTER).setMarginBottom(6));

            // ── Remarks ──
            if (reportCard.getTeacherRemarks() != null && !reportCard.getTeacherRemarks().isEmpty()) {
                document.add(new Paragraph("Teacher's Remarks: " + reportCard.getTeacherRemarks()).setFontSize(8).setMarginBottom(2));
            }
            if (reportCard.getPrincipalRemarks() != null && !reportCard.getPrincipalRemarks().isEmpty()) {
                document.add(new Paragraph("Principal's Remarks: " + reportCard.getPrincipalRemarks()).setFontSize(8).setMarginBottom(2));
            }

            // ── Signature Area ──
            document.add(new Paragraph("\n"));
            Table stampTable = new Table(UnitValue.createPercentArray(new float[]{30, 40, 30}));
            stampTable.setWidth(UnitValue.createPercentValue(100));

            Cell teacherCell = new Cell().setBorder(Border.NO_BORDER);
            teacherCell.add(new Paragraph("\n\n").setFontSize(4));
            teacherCell.add(new Paragraph("____________________").setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            teacherCell.add(new Paragraph("Class Teacher").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setBold());
            stampTable.addCell(teacherCell);

            Cell sealCell = new Cell().setBorder(Border.NO_BORDER);
            sealCell.add(new Paragraph("\n").setFontSize(4));
            sealCell.add(new Paragraph("[School Seal]").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.LIGHT_GRAY));
            stampTable.addCell(sealCell);

            Cell principalCell = new Cell().setBorder(Border.NO_BORDER);
            principalCell.add(new Paragraph("\n\n").setFontSize(4));
            principalCell.add(new Paragraph("____________________").setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            principalCell.add(new Paragraph("Principal").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setBold());
            stampTable.addCell(principalCell);
            document.add(stampTable);

            // ── Footer ──
            document.add(new Paragraph("This is a computer-generated report card.")
                    .setFontSize(6).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.GRAY).setMarginTop(5));

            document.close();
            logger.info("Report card PDF generated successfully for reportCardId={}", reportCardId);
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating report card PDF for reportCardId={}: {}", reportCardId, e.getMessage(), e);
            throw new RuntimeException("Failed to generate report card PDF", e);
        }
    }

    /**
     * Thread-local prefetch cache for {@link #generateBulkReportCards}.
     * The per-student {@link #generateReportCard} method used to re-fetch
     * the same exam list, assessments list, and subjects catalog 50×
     * for a 50-student class. Setting this once before the loop and
     * having the per-student path read from it collapses those reads
     * to a single round trip each.
     */
    private static final ThreadLocal<BulkPrefetch> BULK_PREFETCH = new ThreadLocal<>();

    private static final class BulkPrefetch {
        final List<Exam> examsByClassYear;
        final List<StudentAssessments> assessmentsByExamIds;
        final List<Subject> subjects;
        /** Subjects assigned to the bulk's class — prefetched so the per-
         *  student "Not Scheduled" loop stops doing N identical
         *  findByClassIdAndAcademicYearId queries for a class of N kids. */
        final List<Subject> classSubjects;
        /** Subject lookup map keyed by subjectId — kills the per-subject
         *  findById() inside the main loop in favour of an O(1) hashmap hit. */
        final Map<String, Subject> subjectById;
        /** SchoolClass is identical for every student in the bulk, so we
         *  look it up once up front instead of 50 times inside the loop. */
        final SchoolClass schoolClass;
        /** Academic-year label is identical across the bulk too. */
        final AcademicYear academicYear;
        BulkPrefetch(List<Exam> exams, List<StudentAssessments> assessments, List<Subject> subjects,
                     List<Subject> classSubjects, SchoolClass schoolClass, AcademicYear academicYear) {
            this.examsByClassYear = exams;
            this.assessmentsByExamIds = assessments;
            this.subjects = subjects;
            this.classSubjects = classSubjects;
            this.subjectById = new HashMap<>();
            for (Subject s : subjects) {
                if (s != null && s.getSubjectId() != null) this.subjectById.put(s.getSubjectId(), s);
            }
            this.schoolClass = schoolClass;
            this.academicYear = academicYear;
        }
    }

    public List<ReportCard> generateBulkReportCards(String classId, String academicYearId, String examType) {
        return generateBulkReportCards(classId, null, academicYearId, examType);
    }

    /**
     * Overload that narrows the student set to a specific section before
     * generating report cards. Critical for performance — a "1st" class
     * with 4 sections × 50 students = 200 cards otherwise, even when
     * the admin only wants Section A. With the sectionId filter we cut
     * that to ~50 cards. Null sectionId keeps the legacy whole-class
     * behaviour for callers (e.g. the bulk PDF download) that genuinely
     * want every section.
     */
    public List<ReportCard> generateBulkReportCards(String classId, String sectionId,
                                                     String academicYearId, String examType) {
        long start = System.currentTimeMillis();
        logger.info("Generating bulk report cards for classId={}, sectionId={}, academicYearId={}, examType={}",
                classId, sectionId, academicYearId, examType);

        List<Student> students = (sectionId != null && !sectionId.isBlank())
                ? studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(classId, sectionId)
                : studentRepository.findByClassIdAndDeletedAtIsNull(classId, Pageable.unpaged()).getContent();
        List<ReportCard> reportCards = new ArrayList<>();

        // ── One-shot prefetch of the shared data ──
        // Without this each per-student call re-runs the same queries —
        // for a 50-student class that was hundreds of extra Mongo round
        // trips on the hot path, and showed up as 20–30s to open the
        // Report Cards page. Set the prefetch BEFORE the loop; the
        // per-student method reads it via the ThreadLocal.
        //
        // What we prefetch (all are identical for every student in the bulk):
        //  - exams for (class, year)
        //  - studentassessments for those exam ids
        //  - every Subject row (we also build a subjectId->Subject map
        //    so the per-subject findById() in the main loop is O(1))
        //  - subjects assigned to this class (powers the "Not Scheduled"
        //    row loop — was running once per student with identical args)
        //  - SchoolClass doc for the class (identical across the bulk)
        //  - AcademicYear doc for the label stamp
        List<Exam> prefetchedExams = examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        List<String> examIds = prefetchedExams.stream().map(Exam::getExamId).collect(Collectors.toList());
        List<StudentAssessments> prefetchedAssessments = examIds.isEmpty()
                ? java.util.Collections.emptyList()
                : assessmentsRepository.findByExamIdIn(examIds);
        List<Subject> prefetchedSubjects = subjectRepository.findAll();
        List<Subject> prefetchedClassSubjects = subjectRepository
                .findByClassIdAndAcademicYearId(classId, academicYearId);
        SchoolClass prefetchedClass = schoolClassRepository.findById(classId).orElse(null);
        AcademicYear prefetchedYear = academicYearRepository.findById(academicYearId).orElse(null);
        BULK_PREFETCH.set(new BulkPrefetch(
                prefetchedExams, prefetchedAssessments, prefetchedSubjects,
                prefetchedClassSubjects, prefetchedClass, prefetchedYear));

        try {
            // Build each report card in memory ONLY — the
            // persistImmediately=false flag suppresses the per-student
            // save() that used to fire 50× for a 50-student class. We
            // do one bulk saveAll() at the end after ranks are
            // assigned, dropping write count from 2N to a single batch.
            for (Student student : students) {
                try {
                    ReportCard rc = generateReportCard(student.getStudentId(), academicYearId, examType, false);
                    reportCards.add(rc);
                } catch (Exception e) {
                    logger.error("Error generating report card for studentId={}: {}", student.getStudentId(), e.getMessage());
                }
            }
        } finally {
            // ThreadLocals MUST be cleared after use — otherwise a
            // worker thread pulled from Tomcat's pool would carry the
            // stale prefetch into an unrelated request.
            BULK_PREFETCH.remove();
        }

        // Rank by percentage (descending), then bulk-write everything in one
        // round trip. Previously this loop save()d each card individually,
        // turning 50 students into 50 extra Mongo writes that happened
        // AFTER the 50 writes already done by generateReportCard above.
        //
        // Students the teacher hasn't entered ANY marks for don't get a
        // rank — otherwise a class whose teacher hasn't started grading
        // would show "#1 … #50 all at 0.0%", which looks like a
        // leaderboard where there isn't one. "Entered 0" is a valid
        // real score (ranks normally), so the signal we use is "at
        // least one subject with an actual entry" via the overall
        // grade — a fresh "no entries" card has grade "—" (see
        // generateReportCard above). Rank 0 is interpreted by the UI
        // as "no rank" and renders as "—".
        reportCards.sort((a, b) -> Double.compare(b.getPercentage(), a.getPercentage()));
        int rank = 0;
        for (ReportCard rc : reportCards) {
            boolean hasEntry = rc.getGrade() != null && !"—".equals(rc.getGrade());
            if (hasEntry) {
                rc.setRank(++rank);
            } else {
                rc.setRank(0);
            }
        }
        if (!reportCards.isEmpty()) {
            reportCardRepository.saveAll(reportCards);
        }

        long elapsed = System.currentTimeMillis() - start;
        logger.info("Bulk report cards generated: {} cards for classId={} in {} ms",
                reportCards.size(), classId, elapsed);
        return reportCards;
    }

    public byte[] generateBulkPdf(String classId, String academicYearId, String examType, String tenantId) {
        logger.info("Generating bulk PDF zip for classId={}, academicYearId={}, examType={}", classId, academicYearId, examType);

        List<ReportCard> reportCards = generateBulkReportCards(classId, academicYearId, examType);

        try {
            ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
            ZipOutputStream zipOut = new ZipOutputStream(zipBaos);

            for (ReportCard rc : reportCards) {
                try {
                    byte[] pdfBytes = generateReportCardPdf(rc.getId(), tenantId);
                    String fileName = "report_card_" + (rc.getStudentName() != null ? rc.getStudentName().replaceAll("[^a-zA-Z0-9]", "_") : rc.getStudentId()) + ".pdf";
                    zipOut.putNextEntry(new ZipEntry(fileName));
                    zipOut.write(pdfBytes);
                    zipOut.closeEntry();
                } catch (Exception e) {
                    logger.error("Error generating PDF for student {}: {}", rc.getStudentId(), e.getMessage());
                }
            }

            zipOut.close();
            logger.info("Bulk PDF zip generated with {} report cards", reportCards.size());
            return zipBaos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating bulk PDF zip: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate bulk PDF zip", e);
        }
    }

    private String calculateGrade(double percentage) {
        if (percentage >= 90) return "A+";
        if (percentage >= 80) return "A";
        if (percentage >= 70) return "B+";
        if (percentage >= 60) return "B";
        if (percentage >= 50) return "C";
        if (percentage >= 40) return "D";
        return "F";
    }

    // ── Per-component aggregation helpers ─────────────────────────────

    /** Bundles the per-component breakdown plus rolled-up subject totals. */
    private static class ComponentAggregate {
        List<ReportCard.ComponentGrade> componentGrades = new ArrayList<>();
        double totalObtained;
        double totalMax;
        boolean subjectPassed;
    }

    /**
     * Build per-component grades for a given subject and student.
     *
     * <p>For EXAM components: walk the supplied exam list, sum marks
     * where {@code exam.subjectId == subject.id} and
     * {@code exam.componentKey} matches (or is null on a
     * single-component subject).
     *
     * <p>For INTERNAL components: pull from the pre-fetched internal
     * marks list, sum across terms / pick the single year-scoped row.
     *
     * <p>Subject pass/fail is computed using the subject's
     * {@code passRule}:
     * <ul>
     *   <li>{@code PER_COMPONENT}: subject passes iff every component passes
     *   <li>{@code COMBINED}: subject passes iff total obtained &gt;= total pass marks
     * </ul>
     */
    private ComponentAggregate aggregateComponents(
            Subject subject,
            String studentId,
            String academicYearId,
            List<Exam> exams,
            Map<String, Double> examMarksByExamId,
            Map<String, Map<String, Double>> componentMarksByExamId,
            List<ComponentInternalMark> allInternalMarks) {
        ComponentAggregate out = new ComponentAggregate();
        Subject.PassRule passRule = subject.getPassRule() == null
                ? Subject.PassRule.PER_COMPONENT
                : subject.getPassRule();
        double sumPassMarks = 0;
        boolean everyComponentPassed = true;

        for (Subject.Component comp : subject.getComponents()) {
            ReportCard.ComponentGrade cg = new ReportCard.ComponentGrade();
            cg.setKey(comp.getKey());
            cg.setLabel(comp.getLabel());
            // Fallback caps come from Subject.Component (legacy data). The exam
            // resolution below overrides these with the exam doc's own max/pass —
            // schools commonly run UT1 at 40+10 and Final at 80+20 against the
            // same subject, so the truth lives on the exam, not the subject.
            cg.setMaxMarks(comp.getMaxMarks() == null ? 0 : comp.getMaxMarks());
            cg.setPassMarks(comp.getPassMarks() == null ? 0 : comp.getPassMarks());
            cg.setAssessmentMode(comp.getAssessmentMode() == null ? "EXAM" : comp.getAssessmentMode().name());

            double obtained = 0;
            double effectiveMax = cg.getMaxMarks();
            double effectivePass = cg.getPassMarks();
            boolean matchedAnyExam = false;
            boolean isSingleComponent = subject.getComponents().size() == 1;

            for (Exam exam : exams) {
                if (!subject.getSubjectId().equals(exam.getSubjectId())) continue;

                // Combined-mode exam: look for this component inside the
                // exam's components[] list and pull max/pass + obtained from
                // there.
                if (exam.getComponents() != null && !exam.getComponents().isEmpty()) {
                    Exam.ExamComponent ec = null;
                    for (Exam.ExamComponent candidate : exam.getComponents()) {
                        if (candidate != null && comp.getKey().equals(candidate.getKey())) {
                            ec = candidate;
                            break;
                        }
                    }
                    if (ec == null) continue;
                    matchedAnyExam = true;
                    effectiveMax = ec.getMaxMarks() == null ? 0 : ec.getMaxMarks();
                    effectivePass = ec.getPassingMarks() == null ? 0 : ec.getPassingMarks();
                    Map<String, Double> compMarks = componentMarksByExamId.get(exam.getExamId());
                    if (compMarks != null) {
                        Double m = compMarks.get(comp.getKey());
                        if (m != null) obtained = m;
                    }
                    // Found the combined exam carrying this component — done.
                    break;
                }

                // Per-component exam: match by componentKey. Single-component
                // subjects may carry a null componentKey on legacy exams; treat
                // null as a match in that case.
                String examCk = exam.getComponentKey();
                boolean componentMatches = comp.getKey().equals(examCk)
                        || (isSingleComponent && (examCk == null || examCk.isBlank()));
                if (!componentMatches) continue;
                matchedAnyExam = true;
                // Combined-exam fix: when the subject component matches
                // by NULL key, the whole multi-component exam contributes
                // here — its effective max/pass is the sum across all
                // components, not the legacy scalar (which was only the
                // first component's max).
                effectiveMax = exam.getEffectiveMaxMarks();
                effectivePass = exam.getEffectivePassingMarks();
                Double m = examMarksByExamId.get(exam.getExamId());
                if (m != null) obtained = m;
                break;
            }

            // INTERNAL component with no matching exam → fall back to the
            // legacy ComponentInternalMark collection so old data still renders.
            boolean hasInternalMarks = false;
            if (!matchedAnyExam && comp.getAssessmentMode() == Subject.AssessmentMode.INTERNAL) {
                for (ComponentInternalMark m : allInternalMarks) {
                    if (!subject.getSubjectId().equals(m.getSubjectId())) continue;
                    if (!comp.getKey().equals(m.getComponentKey())) continue;
                    if (m.getMarksObtained() != null) {
                        obtained += m.getMarksObtained();
                        hasInternalMarks = true;
                    }
                }
            }

            // Skip components that were never tested in this period — neither
            // by an exam nor by an internal-mark entry. Without this guard a
            // Practical excluded from a Theory-only Unit Test still surfaced
            // on the report card as "0 / 30 FAIL", dragging the subject total
            // and tripping the PER_COMPONENT pass rule. With it, the report
            // only shows what was actually assessed.
            if (!matchedAnyExam && !hasInternalMarks) {
                continue;
            }

            cg.setMaxMarks(effectiveMax);
            cg.setPassMarks(effectivePass);
            cg.setMarksObtained(obtained);
            boolean componentPassed = obtained >= effectivePass;
            cg.setPassed(componentPassed);

            // Per-component attendance % for trackAttendance components.
            if (comp.isTrackAttendance()) {
                cg.setAttendancePercentage(calculateComponentAttendance(
                        studentId, academicYearId, subject.getSubjectId(), comp.getKey()));
            }

            out.componentGrades.add(cg);
            out.totalObtained += obtained;
            out.totalMax += effectiveMax;
            sumPassMarks += effectivePass;
            if (!componentPassed) everyComponentPassed = false;
        }

        if (passRule == Subject.PassRule.PER_COMPONENT) {
            out.subjectPassed = everyComponentPassed;
        } else {
            out.subjectPassed = out.totalObtained >= sumPassMarks;
        }
        return out;
    }

    /**
     * Per-component attendance % for the given student. Walks Attendance
     * rows tagged with the matching {@code subjectId + componentKey} for
     * the academic year. Returns null when there are no records (so the
     * UI can show "—" instead of misleadingly displaying 0%).
     */
    private Double calculateComponentAttendance(
            String studentId, String academicYearId, String subjectId, String componentKey) {
        // Pull this student's attendance over a wide date window, then filter
        // in-memory by subject + component. The wide window covers any
        // reasonable academic year shape (Indian school years run Jun–Apr).
        LocalDate from = LocalDate.now().minusYears(2);
        LocalDate to = LocalDate.now().plusDays(1);
        List<Attendance> rows = attendanceRepository.findByStudentIdAndDateBetween(studentId, from, to);
        if (rows == null || rows.isEmpty()) return null;
        int total = 0;
        int present = 0;
        for (Attendance a : rows) {
            if (!academicYearId.equals(a.getAcademicYearId())) continue;
            if (!subjectId.equals(a.getSubjectId())) continue;
            String aCk = a.getComponentKey();
            // Treat null componentKey as a match for the only component (legacy rows).
            if (!componentKey.equals(aCk) && aCk != null) continue;
            total++;
            if (a.getStatus() == Attendance.Status.PRESENT || a.getStatus() == Attendance.Status.LATE) {
                present++;
            }
        }
        if (total == 0) return null;
        return Math.round((present * 1000.0 / total)) / 10.0;
    }

    /**
     * Pick the "newer" of two exams. Prefer examDate; fall back to createdAt.
     * Used when filtering by a specific exam type and more than one exam exists
     * for the same subject — we keep the most recent run.
     */
    private boolean isNewerExam(Exam a, Exam b) {
        LocalDate ad = a.getExamDate();
        LocalDate bd = b.getExamDate();
        if (ad != null && bd != null) return ad.isAfter(bd);
        if (ad != null) return true;
        if (bd != null) return false;
        Instant ac = a.getCreatedAt();
        Instant bc = b.getCreatedAt();
        if (ac != null && bc != null) return ac.isAfter(bc);
        return false;
    }

    private double calculateAttendancePercentage(String studentId, String academicYearId) {
        try {
            LocalDate startDate = LocalDate.of(LocalDate.now().getYear(), 4, 1);
            LocalDate endDate = LocalDate.now();

            long totalDays = attendanceRepository.countByStudentIdAndDateBetween(studentId, startDate, endDate);
            if (totalDays == 0) {
                return 100.0;
            }

            long presentDays = attendanceRepository.countByStudentIdAndStatusAndDateBetween(
                    studentId, Attendance.Status.PRESENT, startDate, endDate);

            return ((double) presentDays / totalDays) * 100;
        } catch (Exception e) {
            logger.warn("Could not calculate attendance for studentId={}: {}", studentId, e.getMessage());
            return 0.0;
        }
    }

    private int calculateRank(String studentId, String classId, String academicYearId, double studentPercentage) {
        try {
            List<ReportCard> classReports = reportCardRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
            int rank = 1;
            for (ReportCard rc : classReports) {
                if (!rc.getStudentId().equals(studentId) && rc.getPercentage() > studentPercentage) {
                    rank++;
                }
            }
            return rank;
        } catch (Exception e) {
            logger.warn("Could not calculate rank for studentId={}: {}", studentId, e.getMessage());
            return 0;
        }
    }

    private void addHeaderCell(Table table, String text) {
        Cell cell = new Cell();
        cell.setBackgroundColor(ColorConstants.LIGHT_GRAY);
        cell.add(new Paragraph(text).setBold().setFontSize(10).setTextAlignment(TextAlignment.CENTER));
        table.addCell(cell);
    }

    private void addInfoCell(Table table, String label, String value) {
        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .add(new Paragraph(label).setBold().setFontSize(10)));
        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .add(new Paragraph(value != null ? value : "N/A").setFontSize(10)));
    }

    private void addCompactInfoCell(Table table, String label, String value) {
        table.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(new Paragraph(label).setBold().setFontSize(8)));
        table.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(new Paragraph(value != null ? value : "-").setFontSize(8)));
    }

    private void addCompactHeaderCell(Table table, String text) {
        Cell cell = new Cell();
        cell.setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(2);
        cell.add(new Paragraph(text).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
        table.addCell(cell);
    }

    /**
     * Strip a trailing ".0" from whole-number marks so the table reads
     * "65 / 70" instead of "65.0 / 70.0". Fractional marks keep their
     * decimal so 75.5 stays accurate.
     */
    private String trimDecimal(double v) {
        if (v == Math.floor(v) && !Double.isInfinite(v)) {
            return String.valueOf((long) v);
        }
        return String.valueOf(v);
    }
}
