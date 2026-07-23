package com.saas.school.modules.otherassessment.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import com.saas.school.modules.otherassessment.model.OtherAssessment;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Publishes assessment results as in-app notifications to students +
 * their parents. Mirrors the flow used by {@code ResultPublicationService}
 * for report-card exams but scoped to a single Other Assessment.
 *
 * <p>Two-step API: {@link #preview} returns a sample notification and
 * recipient counts so the admin can review before firing; {@link #send}
 * fans out one personalised {@link Notification} per student.</p>
 */
@Service
public class OtherAssessmentNotifyService {

    private static final Logger log = LoggerFactory.getLogger(OtherAssessmentNotifyService.class);

    @Autowired private OtherAssessmentService assessmentService;
    @Autowired private StudentRepository studentRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private AuditService auditService;

    // ── Preview ──────────────────────────────────────────────

    /** Recipient counts + a sample of what the first-marked student
     *  would see. Rendered per-request so any edit to marks between
     *  preview and send is reflected. */
    public NotifyPreview preview(String assessmentId) {
        OtherAssessment doc = assessmentService.get(assessmentId);
        List<OtherAssessment.StudentEntry> withMarks = studentsWithMarks(doc);

        NotifyPreview out = new NotifyPreview();
        out.studentCount = withMarks.size();
        out.title = renderTitle(doc);

        if (withMarks.isEmpty()) {
            out.body = "No students have marks entered yet. Save marks first.";
            out.sampleStudentName = null;
            out.parentCount = 0;
            out.totalRecipients = 0;
            return out;
        }

        // Sample body from the first ranked student so preview reads
        // like a real notification, not zeros.
        var sample = withMarks.get(0);
        out.sampleStudentName = sample.getFullName();
        out.body = renderBody(sample, doc);

        // Recipient counts — one Notification per student, but a
        // per-student notification fans out to (studentUserId + parentIds).
        Map<String, Student> studentByStudentId = studentIndex(withMarks);
        int parentTotal = 0;
        int studentUserTotal = 0;
        for (var e : withMarks) {
            Student s = studentByStudentId.get(e.getStudentId());
            if (s == null) continue;
            if (s.getUserId() != null && !s.getUserId().isBlank()) studentUserTotal++;
            if (s.getParentIds() != null) {
                for (String pid : s.getParentIds()) {
                    if (pid != null && !pid.isBlank()) parentTotal++;
                }
            }
        }
        out.parentCount = parentTotal;
        out.totalRecipients = studentUserTotal + parentTotal;
        return out;
    }

    // ── Send ─────────────────────────────────────────────────

    /** Send one personalised notification to each student (+ parents)
     *  who has at least one mark on the assessment. */
    public NotifyResult send(String assessmentId, String adminUserId) {
        OtherAssessment doc = assessmentService.get(assessmentId);
        List<OtherAssessment.StudentEntry> withMarks = studentsWithMarks(doc);
        if (withMarks.isEmpty()) {
            throw new BusinessException("No students have marks entered — save marks first.");
        }

        String title = renderTitle(doc);
        Map<String, Student> studentByStudentId = studentIndex(withMarks);

        int notified = 0;
        int skippedNoAccount = 0;
        int parentsHit = 0;

        for (var entry : withMarks) {
            Student student = studentByStudentId.get(entry.getStudentId());

            List<String> recipients = new ArrayList<>();
            if (student != null) {
                if (student.getUserId() != null && !student.getUserId().isBlank()) {
                    recipients.add(student.getUserId());
                }
                if (student.getParentIds() != null) {
                    for (String pid : student.getParentIds()) {
                        if (pid != null && !pid.isBlank()) recipients.add(pid);
                    }
                }
            }
            if (recipients.isEmpty()) {
                skippedNoAccount++;
                continue;
            }

            String body = renderBody(entry, doc);
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
                parentsHit += recipients.size() - 1;   // beyond the student is a parent
            } catch (Exception e) {
                log.error("OtherAssessment notify: send failed for student {} ({}): {}",
                        entry.getStudentId(), entry.getFullName(), e.getMessage());
                skippedNoAccount++;
            }
        }

        auditService.log("OTHER_ASSESSMENT_NOTIFY", "OtherAssessment", assessmentId,
                "Sent for '" + doc.getName() + "': notified=" + notified
                        + " parents=" + parentsHit + " skipped=" + skippedNoAccount);

        NotifyResult r = new NotifyResult();
        r.notifiedStudents = notified;
        r.notifiedParents = parentsHit;
        r.skipped = skippedNoAccount;
        return r;
    }

    // ── Rendering ────────────────────────────────────────────

    private String renderTitle(OtherAssessment doc) {
        // e.g. "CET Test-02 — Results" — the type prefix keeps
        // notification lists scannable when a school runs weekly
        // CETs alongside mocks.
        String type = doc.getType() == null ? "" : doc.getType().trim();
        String name = doc.getName() == null ? "Assessment" : doc.getName().trim();
        return (type.isBlank() ? name : (type + " " + name)) + " — Results";
    }

    private String renderBody(OtherAssessment.StudentEntry entry, OtherAssessment doc) {
        StringBuilder sb = new StringBuilder();
        String greetName = entry.getFullName() == null ? "Student" : entry.getFullName();
        String dateStr = doc.getTestDate() == null ? ""
                : doc.getTestDate().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));
        sb.append("Hi ").append(greetName).append(",\n");
        sb.append("Your results for ").append(doc.getName());
        if (doc.getType() != null && !doc.getType().isBlank()) sb.append(" (").append(doc.getType()).append(")");
        if (!dateStr.isBlank()) sb.append(" on ").append(dateStr);
        sb.append(":\n");

        // Per-subject lines — match the marks-entry table order (uses
        // doc.getSubjects()) so a preview and the parent's marksheet
        // read the same way.
        Map<String, Double> marksBySubject = new HashMap<>();
        if (entry.getSubjects() != null) {
            for (var m : entry.getSubjects()) {
                if (m.getMarksObtained() != null) marksBySubject.put(m.getSubjectId(), m.getMarksObtained());
            }
        }

        double total = 0d;
        double max = 0d;
        if (doc.getSubjects() != null) {
            for (var s : doc.getSubjects()) {
                Double v = marksBySubject.get(s.getSubjectId());
                Integer subMax = s.getMaxMarks();
                sb.append("• ").append(s.getSubjectName()).append(": ");
                if (v == null) sb.append("—");
                else sb.append(formatMark(v));
                if (subMax != null) sb.append("/").append(subMax);
                sb.append("\n");
                if (v != null) total += v;
                if (subMax != null) max += subMax;
            }
        }
        sb.append("Total: ").append(formatMark(total));
        if (max > 0) sb.append("/").append(formatMark(max));
        if (max > 0) {
            double pct = Math.round(total / max * 1000d) / 10d;
            sb.append("  (").append(formatMark(pct)).append("%)");
        }
        sb.append("\n");
        if (entry.getRank() != null) sb.append("Rank: ").append(entry.getRank());
        return sb.toString();
    }

    private String formatMark(double v) {
        if (v == Math.floor(v)) return Long.toString((long) v);
        return Double.toString(Math.round(v * 10d) / 10d);
    }

    // ── Helpers ──────────────────────────────────────────────

    private List<OtherAssessment.StudentEntry> studentsWithMarks(OtherAssessment doc) {
        List<OtherAssessment.StudentEntry> out = new ArrayList<>();
        if (doc.getStudents() == null) return out;
        for (var s : doc.getStudents()) {
            if (s.getSubjects() == null) continue;
            for (var m : s.getSubjects()) {
                if (m.getMarksObtained() != null) { out.add(s); break; }
            }
        }
        return out;
    }

    private Map<String, Student> studentIndex(List<OtherAssessment.StudentEntry> entries) {
        List<String> ids = new ArrayList<>();
        for (var e : entries) if (e.getStudentId() != null) ids.add(e.getStudentId());
        Map<String, Student> out = new HashMap<>();
        if (ids.isEmpty()) return out;
        for (Student s : studentRepository.findByStudentIdInAndDeletedAtIsNull(ids)) {
            if (s.getStudentId() != null) out.put(s.getStudentId(), s);
        }
        return out;
    }

    // ── DTOs ────────────────────────────────────────────────

    public static class NotifyPreview {
        public String title;
        public String body;
        public String sampleStudentName;
        public int studentCount;
        public int parentCount;
        public int totalRecipients;
    }

    public static class NotifyResult {
        public int notifiedStudents;
        public int notifiedParents;
        public int skipped;
    }
}
