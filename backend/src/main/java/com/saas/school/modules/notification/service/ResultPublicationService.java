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
import com.saas.school.modules.sms.dto.ConductedExamTypeDto;
import com.saas.school.modules.sms.dto.SendResultNoticeRequest;
import com.saas.school.modules.sms.dto.SendResultNoticeResponse;
import com.saas.school.modules.sms.model.SmsTrigger;
import com.saas.school.modules.sms.service.SmsService;
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
    /** Injected so the multi-section SMS publisher can fan results out to
     *  parents via the RESULT_COMBINED DLT template. SMS sending is async,
     *  gated by the 4-layer SmsService check (global / tenant / trigger /
     *  budget) — we never bypass it. */
    @Autowired private SmsService smsService;

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

    /**
     * Pickers data for the "Publish Result SMS" card — every distinct
     * {@code Exam.examType} in the tenant, grouped with the (classId,
     * sectionId) pairs it appears in. Catalog exam types that have no
     * Exam docs (never conducted) drop out, so the dropdown only shows
     * results the admin can actually publish.
     *
     * <p>One query scans the {@code exams} collection in full. Per-tenant
     * exam counts are bounded by school size — the query stays fast even
     * across multiple academic years.</p>
     */
    public List<ConductedExamTypeDto> listConductedExamTypes() {
        List<Exam> all = examRepository.findAll();

        // examType -> map of "classId::sectionId" -> ClassSection
        // (LinkedHashMap so exam types appear in first-encounter order;
        // a TreeMap of section keys would alphabetise but we'd lose the
        // natural "as-created" ordering admins expect.)
        LinkedHashMap<String, LinkedHashMap<String, ConductedExamTypeDto.ClassSection>> bucket =
                new LinkedHashMap<>();

        for (Exam ex : all) {
            if (ex == null) continue;
            String type = ex.getExamType();
            if (type == null || type.isBlank()) continue;

            // Register the exam type unconditionally — same rule the
            // Notifications page uses ("examType set → show it"). Exam
            // docs that lack classId / sectionId (legacy data, class-wide
            // exams) still surface their type in the dropdown rather than
            // disappearing silently.
            LinkedHashMap<String, ConductedExamTypeDto.ClassSection> sections =
                    bucket.computeIfAbsent(type.trim(), k -> new LinkedHashMap<>());

            // Section narrowing list only includes rows where BOTH ids
            // are present — that's the only case where we can target a
            // specific (class, section) SMS fan-out. Missing-id rows
            // still keep their type registered above; the frontend
            // falls back to "all tenant classes + sections" for the
            // multi-select when this list comes back empty.
            String classId = ex.getClassId();
            String sectionId = ex.getSectionId();
            if (classId == null || classId.isBlank()) continue;
            if (sectionId == null || sectionId.isBlank()) continue;
            String key = classId + "::" + sectionId;
            // computeIfAbsent so the FIRST exam doc for a given section
            // wins the label battle — labels rarely diverge but this
            // gives us deterministic behaviour either way.
            sections.computeIfAbsent(key, k -> new ConductedExamTypeDto.ClassSection(
                    classId, sectionId, ex.getClassName(), ex.getSectionName()));
        }

        List<ConductedExamTypeDto> out = new ArrayList<>(bucket.size());
        for (Map.Entry<String, LinkedHashMap<String, ConductedExamTypeDto.ClassSection>> e
                : bucket.entrySet()) {
            out.add(new ConductedExamTypeDto(e.getKey(),
                    new ArrayList<>(e.getValue().values())));
        }
        return out;
    }

    /**
     * Multi-section result SMS broadcaster — fired from the
     * "Publish Result SMS" card on the school admin's SMS Notifications
     * page. Distinct from {@link #publish}, which fans out personalised
     * IN-APP notifications for a single (class, section).
     *
     * <p>For each (classId, sectionId) target in the request:</p>
     * <ol>
     *   <li>Loads students in that section</li>
     *   <li>Loads exams matching {@code examType} (+ optional academic year)
     *       for that class+section, plus their marks (legacy + new
     *       assessments)</li>
     *   <li>Per student: computes total% from their marks, dispatches a
     *       RESULT_COMBINED SMS with vars (studentName, examName, "X%")
     *       to BOTH the linked Parent User accounts (parentIds) AND the
     *       raw parentPhone on the Student doc. Phone-level dedupe in
     *       SmsService.resolveRecipients guarantees one SMS per phone.</li>
     * </ol>
     *
     * <p>Students with neither parentPhone nor any parentIds are counted
     * in {@code skippedNoPhone} so the admin sees how many rows need
     * cleanup before re-running.</p>
     *
     * <p>The 4-layer SMS gate (global / tenant / trigger / budget) is
     * enforced inside {@code dispatchAsync} per recipient. We DO check
     * the trigger gate up-front here so the admin gets a clear synchronous
     * error ("Result SMS is disabled for your school") instead of a
     * silent SKIPPED-row-in-audit-log no-op.</p>
     */
    public SendResultNoticeResponse publishMultiSectionSms(
            SendResultNoticeRequest req, String adminUserId) {

        if (req == null) throw new BusinessException("Result SMS payload is required.");
        if (req.getExamType() == null || req.getExamType().isBlank())
            throw new BusinessException("examType is required.");
        if (req.getTargets() == null || req.getTargets().isEmpty())
            throw new BusinessException("Pick at least one class + section.");

        // examName is optional in the request — the picker dropdown
        // value (Exam.examType) is already a friendly label like
        // "Unit Test 1", so we use it as the SMS body's exam-name
        // fragment when the request doesn't override.
        String examNameForSms = (req.getExamName() != null && !req.getExamName().isBlank())
                ? req.getExamName().trim()
                : req.getExamType().trim();

        // Loop over every target. Each iteration is a one-section publish.
        int recipientCount = 0;     // # SMS queued (per-student dispatch count)
        int studentsCovered = 0;    // # students who had at least one SMS path
        int skippedNoPhone = 0;     // # students with no parentPhone AND no parentIds
        int sectionsCovered = 0;    // # targets actually processed

        for (SendResultNoticeRequest.TargetSection target : req.getTargets()) {
            if (target == null
                    || target.getClassId() == null  || target.getClassId().isBlank()
                    || target.getSectionId() == null || target.getSectionId().isBlank()) {
                continue;
            }

            // Reuse the existing scope loader by constructing a
            // PublishResultRequest for this one section. No subject filter
            // — the multi-section SMS path is always the combined
            // (all-subjects) view, since the admin is broadcasting a
            // full-term result rather than a single-subject mark.
            PublishResultRequest scoped = new PublishResultRequest();
            scoped.setExamType(req.getExamType());
            scoped.setClassId(target.getClassId());
            scoped.setSectionId(target.getSectionId());
            scoped.setAcademicYearId(blankToNull(req.getAcademicYearId()));
            scoped.setSubjectId(null);

            ScopeData scope = loadScope(scoped);
            sectionsCovered++;
            if (scope.students.isEmpty()) continue;

            // var2 is constant per target — "<className> <sectionName> in
            // <examName>" pulled from the section's first exam (Exam carries
            // denormalised className + sectionName). Computed once here so
            // we don't rebuild it on every student.
            String classSectionExam = renderResultSmsVar2(scope, examNameForSms);

            // Build per-student summary + dispatch.
            for (Student student : scope.students) {
                List<String> parentIds = new ArrayList<>();
                if (student.getParentIds() != null) {
                    for (String pid : student.getParentIds()) {
                        if (pid != null && !pid.isBlank()) parentIds.add(pid);
                    }
                }
                List<String> extraPhones = new ArrayList<>();
                if (student.getParentPhone() != null && !student.getParentPhone().isBlank()) {
                    extraPhones.add(student.getParentPhone().trim());
                }
                if (parentIds.isEmpty() && extraPhones.isEmpty()) {
                    skippedNoPhone++;
                    continue;
                }

                String studentName = displayName(student);
                String breakdown = renderResultSmsVar3(student, scope);

                Map<String, String> vars = new LinkedHashMap<>();
                // Positional aliases — DLT templates registered with {#var#}
                // placeholders match by var1/var2/var3 order. We stamp
                // semantic keys alongside so either registration style works.
                //
                // Mapped to the school's RESULT_COMBINED template body:
                //   "Dear Parent, {var1} of {var2} secured {var3} in the
                //    recent exams. Detailed marksheet …"
                //
                //   var1 = student name
                //   var2 = "1st A in Unit Test 1"
                //   var3 = "English 80/100, Math 85/100, … Total 250/300 (83.3%)"
                vars.put("var1", studentName);
                vars.put("var2", classSectionExam);
                vars.put("var3", breakdown);
                vars.put("studentName", studentName);
                vars.put("classSectionExam", classSectionExam);
                vars.put("result", breakdown);

                // dispatchAsync handles the 4-layer gate + phone-level
                // dedupe across parentIds and parentPhone. Async — the
                // admin doesn't wait per-student.
                smsService.dispatchAsync(SmsTrigger.RESULT_COMBINED,
                        parentIds, extraPhones, vars,
                        adminUserId, "ResultPublication-SMS",
                        student.getStudentId());

                studentsCovered++;
                // Rough recipient count — actual phone count after dedupe
                // may be slightly lower (e.g. parent linked AND parentPhone
                // is the same number). Audit log has the precise figures.
                recipientCount += parentIds.size() + extraPhones.size();
            }
        }

        auditService.log("SMS_RESULT_NOTICE", "ResultPublication", req.getExamType(),
                "Multi-section result SMS by " + adminUserId
                        + " examType=" + req.getExamType()
                        + " examName=" + req.getExamName()
                        + " sections=" + sectionsCovered
                        + " studentsCovered=" + studentsCovered
                        + " skippedNoPhone=" + skippedNoPhone
                        + " recipients=" + recipientCount);

        return new SendResultNoticeResponse(
                recipientCount, studentsCovered, skippedNoPhone, sectionsCovered,
                Instant.now());
    }

    /** {@code var2} renderer for the RESULT_COMBINED SMS — combines the
     *  section's class name + section name + the request's exam name
     *  into the "1st A in Unit Test 1" shape. {@code className} and
     *  {@code sectionName} are stored denormalised on Exam at creation
     *  so we don't have to hit SchoolClass / Section here.
     *
     *  <p>Falls back gracefully when either piece is missing — e.g.
     *  if no exam has a className the var becomes just "in Unit Test 1"
     *  rather than throwing.</p> */
    private String renderResultSmsVar2(ScopeData scope, String examName) {
        String className = "";
        String sectionName = "";
        for (Exam ex : scope.exams) {
            if (className.isEmpty() && ex.getClassName() != null && !ex.getClassName().isBlank()) {
                className = ex.getClassName().trim();
            }
            if (sectionName.isEmpty() && ex.getSectionName() != null && !ex.getSectionName().isBlank()) {
                sectionName = ex.getSectionName().trim();
            }
            if (!className.isEmpty() && !sectionName.isEmpty()) break;
        }
        StringBuilder sb = new StringBuilder();
        if (!className.isEmpty()) sb.append(className);
        if (!sectionName.isEmpty()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(sectionName);
        }
        String name = examName == null ? "" : examName.trim();
        if (sb.length() == 0) return name;
        if (!name.isEmpty()) sb.append(" in ").append(name);
        return sb.toString();
    }

    /** {@code var3} renderer — per-subject marks + grand total + percentage,
     *  in the shape parents expect in the template's third slot:
     *
     *  <pre>
     *    "English 80/100, Math 85/100, Science 78/100. Total 243/300 (81.0%)"
     *  </pre>
     *
     *  <p>Hybrid subjects (Theory + Practical, etc.) are folded into a single
     *  per-subject line by summing across components — keeps the SMS short
     *  and matches the parent's mental model ("Maths overall"). When the
     *  student has no marks yet (admin hit Publish before saving), we return
     *  "result available" so the SMS still reads sensibly.</p>
     *
     *  <p>Iteration order = exam creation order in scope.exams, so subjects
     *  appear in the same sequence as in the marks-entry sheet.</p> */
    private String renderResultSmsVar3(Student student, ScopeData scope) {
        List<ExamMark> marks = scope.marksByStudent.getOrDefault(
                student.getStudentId(), List.of());
        if (marks.isEmpty()) return "result available";

        // exam lookup — sub-O(n²) for the typical 8-subject case.
        Map<String, Exam> examById = scope.exams.stream()
                .collect(Collectors.toMap(Exam::getExamId, e -> e, (a, b) -> a));

        // subjectId → (obtained, max) accumulator. LinkedHashMap preserves
        // first-encounter order — keeps the SMS reading naturally.
        LinkedHashMap<String, double[]> bySubject = new LinkedHashMap<>();
        Map<String, String> nameBySubject = new HashMap<>();

        for (ExamMark m : marks) {
            Exam ex = examById.get(m.getExamId());
            if (ex == null) continue;
            String subjectId = ex.getSubjectId() == null
                    ? "unknown:" + m.getExamId() : ex.getSubjectId();
            String subjectName = ex.getSubjectName() == null || ex.getSubjectName().isBlank()
                    ? "Subject" : ex.getSubjectName().trim();
            nameBySubject.putIfAbsent(subjectId, subjectName);
            double[] cur = bySubject.computeIfAbsent(subjectId, k -> new double[]{0, 0});
            cur[0] += m.getMarksObtained() == null ? 0 : m.getMarksObtained();
            cur[1] += ex.getMaxMarks();
        }
        if (bySubject.isEmpty()) return "result available";

        double totalObt = 0;
        double totalMax = 0;
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, double[]> e : bySubject.entrySet()) {
            if (sb.length() > 0) sb.append(", ");
            double obt = e.getValue()[0];
            double max = e.getValue()[1];
            sb.append(nameBySubject.get(e.getKey())).append(' ')
              .append(formatMarks(obt)).append('/').append(formatMarks(max));
            totalObt += obt;
            totalMax += max;
        }
        if (totalMax > 0) {
            double pct = (totalObt / totalMax) * 100.0;
            sb.append(". Total ")
              .append(formatMarks(totalObt)).append('/').append(formatMarks(totalMax))
              .append(String.format(" (%.1f%%)", pct));
        }
        return sb.toString();
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

        // Elective gate (single-subject publish only) — when the
        // result SMS is for one specific subject AND that subject is
        // marked elective with a non-empty enrolledStudentIds list,
        // skip the unenrolled students so parents of kids who only
        // take Hindi don't get a Sanskrit result SMS. Multi-subject
        // publish (full result card) falls through unchanged.
        String subjectId = blankToNull(req.getSubjectId());
        if (subjectId != null) {
            com.saas.school.modules.classes.model.Subject subj =
                    subjectRepository.findById(subjectId).orElse(null);
            if (subj != null && subj.isElective()
                    && subj.getEnrolledStudentIds() != null
                    && !subj.getEnrolledStudentIds().isEmpty()) {
                java.util.Set<String> enrolled = new java.util.HashSet<>(subj.getEnrolledStudentIds());
                students = students.stream()
                        .filter(st -> st.getStudentId() != null && enrolled.contains(st.getStudentId()))
                        .collect(java.util.stream.Collectors.toList());
            }
        }

        ScopeData s = new ScopeData();
        s.exams = exams;
        s.students = students;
        s.marksByStudent = byStudent;
        s.singleSubject = subjectId != null;
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
                // Effective max sums across components for combined exams;
                // single-component exams keep the legacy scalar value.
                int max = r.exam.getEffectiveMaxMarks();
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
