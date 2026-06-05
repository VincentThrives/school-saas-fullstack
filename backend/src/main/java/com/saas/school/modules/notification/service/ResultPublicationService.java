package com.saas.school.modules.notification.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import com.saas.school.modules.notification.dto.PublishResultPreviewResponse;
import com.saas.school.modules.notification.dto.PublishResultRequest;
import com.saas.school.modules.notification.dto.PublishResultResponse;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.model.ResultPublication;
import com.saas.school.modules.notification.repository.ResultPublicationRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service behind the "Publish Result" tab in the Notifications page.
 *
 * Workflow:
 *   1. Admin picks examType + class + section + subject (or "All Subjects").
 *   2. UI calls preview() → counts of recipients, sample message, prior-
 *      publication banner.
 *   3. UI confirms → publish() → personalised notifications fan out to
 *      every student plus their parent userIds.
 *
 * Each student gets their own Notification document (RecipientType.INDIVIDUAL)
 * with a body rendered from THEIR marks. NotificationService.send() then
 * pushes via FCM to every recipient that has a registered device token.
 *
 * Idempotency: a ResultPublication row keyed on
 * (examType, classId, sectionId, subjectIdKey) records each publication.
 * publish() refuses to overwrite an existing row unless the request
 * carries {@code republish=true}.
 */
@Service
public class ResultPublicationService {

    private static final Logger log = LoggerFactory.getLogger(ResultPublicationService.class);

    @Autowired private ExamRepository examRepository;
    @Autowired private ExamMarkRepository markRepository;
    @Autowired private StudentAssessmentsRepository assessmentsRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private ResultPublicationRepository publicationRepository;
    @Autowired private AuditService auditService;
    @Autowired private SubjectRepository subjectRepository;

    // ── Public API ─────────────────────────────────────────────

    public PublishResultPreviewResponse preview(PublishResultRequest req) {
        validateScope(req);
        ScopeData scope = loadScope(req);

        // Sample body — pick the first student that has at least one mark
        // recorded so the admin sees a realistic preview rather than
        // "no marks". Fall back to the first student in the section
        // (zero-marks render still works, just looks empty).
        Student sample = scope.students.stream()
                .filter(s -> hasAnyMark(s.getStudentId(), scope.marksByStudent))
                .findFirst()
                .orElse(scope.students.isEmpty() ? null : scope.students.get(0));

        String sampleTitle = renderTitle(req, scope);
        String sampleBody = sample == null
                ? "(no students enrolled in this section)"
                : renderBody(sample, scope);

        Optional<ResultPublication> prior = findPrior(req);
        int parentCount = scope.students.stream()
                .mapToInt(s -> s.getParentIds() == null ? 0 : s.getParentIds().size())
                .sum();

        return new PublishResultPreviewResponse(
                scope.exams.size(),
                scope.students.size(),
                parentCount,
                scope.students.size() + parentCount,
                sample == null ? null : displayName(sample),
                sampleTitle,
                sampleBody,
                prior.map(ResultPublication::getPublishedAt).orElse(null),
                prior.map(ResultPublication::getPublishCount).orElse(0)
        );
    }

    public PublishResultResponse publish(PublishResultRequest req, String adminUserId) {
        validateScope(req);
        ScopeData scope = loadScope(req);

        if (scope.exams.isEmpty()) {
            throw new BusinessException(
                "No exams found for this scope. Make sure the exam type, class, "
              + "section and (if any) subject all match exams that have been created.");
        }

        Optional<ResultPublication> prior = findPrior(req);
        if (prior.isPresent() && !req.isRepublish()) {
            throw new BusinessException(
                "Already published on " + prior.get().getPublishedAt()
              + ". Tick \"Republish\" and try again to resend.");
        }

        String title = renderTitle(req, scope);
        int notified = 0;
        int skipped = 0;
        int parents = 0;

        for (Student student : scope.students) {
            // Build per-student recipient list: their own userId + parents.
            List<String> recipients = new ArrayList<>();
            if (student.getUserId() != null && !student.getUserId().isBlank()) {
                recipients.add(student.getUserId());
            }
            if (student.getParentIds() != null) {
                for (String pid : student.getParentIds()) {
                    if (pid != null && !pid.isBlank()) recipients.add(pid);
                }
            }
            if (recipients.isEmpty()) {
                // No login at all — neither student nor parent has an
                // account. Skip; they'll have to see results from the
                // report card page when their account is set up.
                skipped++;
                continue;
            }

            String body = renderBody(student, scope);

            Notification n = new Notification();
            n.setTitle(title);
            n.setBody(body);
            n.setType(Notification.NotificationType.EXAM);
            n.setChannel(Notification.Channel.IN_APP);
            n.setRecipientType(Notification.RecipientType.INDIVIDUAL);
            n.setRecipientIds(new ArrayList<>(recipients));

            try {
                notificationService.send(n, adminUserId);
                notified++;
                parents += recipients.size() - 1; // everything beyond the student is a parent
            } catch (Exception e) {
                log.error("Publish-result: failed to send to student {} ({}): {}",
                        student.getStudentId(), displayName(student), e.getMessage());
                skipped++;
            }
        }

        // Persist / update the publication row.
        ResultPublication pub = prior.orElseGet(ResultPublication::new);
        pub.setExamType(req.getExamType());
        pub.setClassId(req.getClassId());
        pub.setSectionId(req.getSectionId());
        pub.setSubjectId(blankToNull(req.getSubjectId())); // setter writes subjectIdKey
        pub.setAcademicYearId(req.getAcademicYearId());
        pub.setPublishedBy(adminUserId);
        pub.setPublishedAt(Instant.now());
        pub.setStudentsNotified(notified);
        pub.setParentsNotified(parents);
        pub.setExamsCovered(scope.exams.size());
        pub.setPublishCount(prior.map(p -> p.getPublishCount() + 1).orElse(1));
        publicationRepository.save(pub);

        auditService.log(prior.isPresent() ? "REPUBLISH_RESULT" : "PUBLISH_RESULT",
                "ResultPublication", pub.getId(),
                "Result published — examType=" + req.getExamType()
                        + ", classId=" + req.getClassId()
                        + ", sectionId=" + req.getSectionId()
                        + ", subjectId=" + (req.getSubjectId() == null ? "ALL" : req.getSubjectId())
                        + ", students=" + notified + ", parents=" + parents);

        return new PublishResultResponse(
                scope.exams.size(),
                notified,
                parents,
                skipped,
                prior.isPresent(),
                pub.getPublishedAt()
        );
    }

    // ── Internals ──────────────────────────────────────────────

    private void validateScope(PublishResultRequest req) {
        if (req == null) throw new BusinessException("Missing request body");
        if (req.getExamType() == null || req.getExamType().isBlank())
            throw new BusinessException("Exam type is required");
        if (req.getClassId() == null || req.getClassId().isBlank())
            throw new BusinessException("Class is required");
        if (req.getSectionId() == null || req.getSectionId().isBlank())
            throw new BusinessException("Section is required");
    }

    private Optional<ResultPublication> findPrior(PublishResultRequest req) {
        String key = blankToNull(req.getSubjectId());
        String subjectIdKey = key == null ? ResultPublication.ALL_SUBJECTS_KEY : key;
        return publicationRepository
                .findByExamTypeAndClassIdAndSectionIdAndSubjectIdKey(
                        req.getExamType(), req.getClassId(), req.getSectionId(), subjectIdKey);
    }

    /** Pull every Exam matching examType + class + section (+ subject if
     *  set), then load all marks for those exams in one query, then load
     *  every student in the section. */
    private ScopeData loadScope(PublishResultRequest req) {
        // 1. Exams
        List<Exam> allInClass = examRepository.findByClassId(req.getClassId());
        List<Exam> exams = allInClass.stream()
                .filter(e -> req.getExamType().equalsIgnoreCase(e.getExamType()))
                .filter(e -> Objects.equals(req.getSectionId(), e.getSectionId()))
                .filter(e -> blankToNull(req.getSubjectId()) == null
                        || Objects.equals(req.getSubjectId(), e.getSubjectId()))
                .filter(e -> blankToNull(req.getAcademicYearId()) == null
                        || Objects.equals(req.getAcademicYearId(), e.getAcademicYearId()))
                .collect(Collectors.toList());

        // 2. Marks for those exams, indexed by studentId for O(1) per-student
        // lookup. The system has two storage paths and we have to merge both:
        //   (a) Legacy ExamMark documents — one row per (examId, studentId).
        //   (b) New StudentAssessments documents — one doc per exam carrying
        //       a list of MarkEntry. The "Enter Marks" UI writes here, so
        //       most live data lives in this collection. Without it, preview
        //       falsely reports "no marks recorded".
        List<String> examIds = exams.stream().map(Exam::getExamId).collect(Collectors.toList());
        Map<String, List<ExamMark>> byStudent = new HashMap<>();
        if (!examIds.isEmpty()) {
            // (a) legacy collection
            for (ExamMark m : markRepository.findByExamIdIn(examIds)) {
                if (m.getStudentId() == null) continue;
                byStudent.computeIfAbsent(m.getStudentId(), k -> new ArrayList<>()).add(m);
            }
            // (b) batch assessments — synthesize ExamMark rows so the
            // renderer downstream doesn't care which path the data
            // came from. Dedupe by (examId, studentId) so a student
            // who has BOTH a legacy row and a batch entry doesn't
            // get double-counted in the totals.
            Set<String> seen = new HashSet<>();
            for (List<ExamMark> existing : byStudent.values()) {
                for (ExamMark m : existing) seen.add(m.getExamId() + "::" + m.getStudentId());
            }
            for (StudentAssessments doc : assessmentsRepository.findByExamIdIn(examIds)) {
                if (doc.getEntries() == null) continue;
                for (StudentAssessments.MarkEntry e : doc.getEntries()) {
                    if (e == null || e.getStudentId() == null) continue;
                    String key = doc.getExamId() + "::" + e.getStudentId();
                    if (!seen.add(key)) continue;
                    ExamMark m = new ExamMark();
                    m.setExamId(doc.getExamId());
                    m.setStudentId(e.getStudentId());
                    m.setMarksObtained(e.getMarksObtained());
                    m.setGrade(e.getGrade());
                    m.setRemarks(e.getRemarks());
                    m.setPassed(e.isPassed());
                    byStudent.computeIfAbsent(e.getStudentId(), k -> new ArrayList<>()).add(m);
                }
            }
        }

        // 3. Students in this class+section.
        List<Student> students = studentRepository
                .findByClassIdAndSectionIdAndDeletedAtIsNull(req.getClassId(), req.getSectionId());

        ScopeData s = new ScopeData();
        s.exams = exams;
        s.students = students;
        s.marksByStudent = byStudent;
        s.singleSubject = blankToNull(req.getSubjectId()) != null;
        return s;
    }

    /** Title differs slightly when a single subject vs all subjects. */
    private String renderTitle(PublishResultRequest req, ScopeData scope) {
        if (scope.singleSubject && !scope.exams.isEmpty()) {
            Exam first = scope.exams.get(0);
            String subjectName = first.getSubjectName() != null && !first.getSubjectName().isBlank()
                    ? first.getSubjectName() : "Subject";
            String examName = first.getName() != null && !first.getName().isBlank()
                    ? first.getName() : req.getExamType();
            return examName + " — " + subjectName + " result";
        }
        return req.getExamType() + " results";
    }

    /** Per-student personalised body. */
    private String renderBody(Student student, ScopeData scope) {
        List<ExamMark> studentMarks = scope.marksByStudent.getOrDefault(
                student.getStudentId(), List.of());

        StringBuilder b = new StringBuilder();
        b.append(displayName(student));
        b.append("'s ");
        b.append(scope.singleSubject ? "result is out:\n" : "results are out:\n");

        if (studentMarks.isEmpty()) {
            b.append("(No marks recorded yet — please check with your subject teacher.)");
            return b.toString();
        }

        // Index exams by id so we can pull subject names + maxMarks.
        Map<String, Exam> examById = scope.exams.stream()
                .collect(Collectors.toMap(Exam::getExamId, e -> e, (a, c) -> a));

        if (scope.singleSubject) {
            ExamMark m = studentMarks.get(0);
            Exam ex = examById.get(m.getExamId());
            int max = ex == null ? 100 : ex.getMaxMarks();
            String grade = m.getGrade() == null || m.getGrade().isBlank() ? "—" : m.getGrade();
            b.append(formatMarks(m.getMarksObtained()))
             .append("/").append(max)
             .append(" (Grade ").append(grade).append(")");
            b.append(m.isPassed() ? " — Passed." : " — Did not clear.");
            return b.toString();
        }

        // Combined report — one bullet per subject + a totals line.
        // For hybrid subjects (Physics with Theory + Practical, English
        // with Theory + Internal), exams belonging to the same subject are
        // collapsed into a single bullet that shows the per-component
        // breakdown plus the subject total. Parents see one line per
        // subject regardless of how many components it has.
        //
        // Grouping happens by (subjectId, subjectName). The component
        // label is pulled from the Subject's component config when
        // available; otherwise we fall back to the exam's own componentKey.

        // 1) Bucket the student's exam marks by subject.
        Map<String, List<MarkRow>> rowsBySubject = new LinkedHashMap<>();
        Map<String, String> nameBySubject = new HashMap<>();
        List<ExamMark> sorted = new ArrayList<>(studentMarks);
        sorted.sort(Comparator.comparing(m -> {
            Exam e = examById.get(m.getExamId());
            return e == null ? "" : (e.getSubjectName() == null ? "" : e.getSubjectName());
        }));
        for (ExamMark m : sorted) {
            Exam ex = examById.get(m.getExamId());
            if (ex == null) continue;
            String subjectId = ex.getSubjectId() == null ? ("unknown:" + m.getExamId()) : ex.getSubjectId();
            String subjectName = ex.getSubjectName() == null || ex.getSubjectName().isBlank()
                    ? "Subject" : ex.getSubjectName();
            nameBySubject.putIfAbsent(subjectId, subjectName);
            rowsBySubject.computeIfAbsent(subjectId, k -> new ArrayList<>())
                    .add(new MarkRow(ex, m));
        }

        // 2) Per-subject render — fetch Subject for component labels (best effort).
        double totalObtained = 0;
        int totalMax = 0;
        for (Map.Entry<String, List<MarkRow>> e : rowsBySubject.entrySet()) {
            String subjectId = e.getKey();
            List<MarkRow> rows = e.getValue();
            String subjectName = nameBySubject.get(subjectId);
            Subject subject = subjectRepository.findById(subjectId).orElse(null);

            double subjectObtained = 0;
            int subjectMax = 0;
            boolean multipleComponents = rows.size() > 1;
            StringBuilder parts = new StringBuilder();
            for (MarkRow r : rows) {
                int max = r.exam.getMaxMarks();
                double obtained = r.mark.getMarksObtained() == null ? 0 : r.mark.getMarksObtained();
                subjectObtained += obtained;
                subjectMax += max;

                if (multipleComponents) {
                    String compLabel = resolveComponentLabel(subject, r.exam.getComponentKey());
                    if (parts.length() > 0) parts.append(", ");
                    parts.append(compLabel).append(" ")
                         .append(formatMarks(obtained)).append("/").append(max);
                }
            }
            String grade = rows.size() == 1
                    ? (rows.get(0).mark.getGrade() == null || rows.get(0).mark.getGrade().isBlank()
                            ? "—" : rows.get(0).mark.getGrade())
                    : "";

            b.append("• ").append(subjectName).append(": ");
            if (multipleComponents) {
                b.append(parts).append(", Total ")
                 .append(formatMarks(subjectObtained)).append("/").append(subjectMax)
                 .append("\n");
            } else {
                b.append(formatMarks(subjectObtained)).append("/").append(subjectMax)
                 .append(" (").append(grade).append(")\n");
            }

            totalObtained += subjectObtained;
            totalMax += subjectMax;
        }

        if (totalMax > 0) {
            double pct = (totalObtained / totalMax) * 100.0;
            b.append("Total: ").append(formatMarks(totalObtained))
             .append("/").append(totalMax)
             .append(String.format(" (%.1f%%)", pct));
        }
        return b.toString();
    }

    /** Tuple pairing an exam with its mark for grouping purposes. */
    private static class MarkRow {
        final Exam exam;
        final ExamMark mark;
        MarkRow(Exam e, ExamMark m) { this.exam = e; this.mark = m; }
    }

    /**
     * Look up a friendly label for an exam's componentKey by checking the
     * Subject's component list. Falls back to a title-cased version of the
     * key, or "Component" if the key itself is missing.
     */
    private String resolveComponentLabel(Subject subject, String componentKey) {
        if (subject != null && componentKey != null) {
            Subject.Component c = subject.componentByKey(componentKey);
            if (c != null && c.getLabel() != null && !c.getLabel().isBlank()) {
                return c.getLabel();
            }
        }
        if (componentKey == null || componentKey.isBlank()) return "Component";
        // "practical" -> "Practical"; "internal" -> "Internal"; etc.
        return Character.toUpperCase(componentKey.charAt(0)) + componentKey.substring(1).toLowerCase();
    }

    private String formatMarks(Double v) {
        if (v == null) return "—";
        if (v == Math.floor(v)) return String.valueOf(v.intValue());
        return String.format("%.1f", v);
    }

    private String displayName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last  = s.getLastName()  == null ? "" : s.getLastName().trim();
        if (first.isEmpty() && last.isEmpty()) return "The student";
        return (first + " " + last).trim();
    }

    private boolean hasAnyMark(String studentId, Map<String, List<ExamMark>> byStudent) {
        List<ExamMark> ms = byStudent.get(studentId);
        return ms != null && !ms.isEmpty();
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    /** Internal carrier for the resolved scope so we don't re-query in
     *  multiple methods. */
    private static class ScopeData {
        List<Exam> exams = List.of();
        List<Student> students = List.of();
        Map<String, List<ExamMark>> marksByStudent = Map.of();
        boolean singleSubject;
    }
}
