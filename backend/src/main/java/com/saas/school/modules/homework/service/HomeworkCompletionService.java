package com.saas.school.modules.homework.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.homework.model.HomeworkCompletion;
import com.saas.school.modules.homework.model.HomeworkCompletion.Status;
import com.saas.school.modules.homework.repository.HomeworkCompletionRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.repository.NotificationRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * All the read/write plumbing for homework completion tracking.
 * The Notifications module stays intact — this service only touches
 * the homework_completions collection plus a read on Notification /
 * Student.
 */
@Service
public class HomeworkCompletionService {

    @Autowired private HomeworkCompletionRepository completionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private com.saas.school.modules.notification.service.NotificationService notificationService;

    // ── Reads ────────────────────────────────────────────────────

    /**
     * Roster view for a teacher's Homework detail popup.
     * Enumerates the students who should have this homework and
     * marks each one done/pending. Falls back to whole-class if the
     * notification carries no section (legacy or class-wide sends).
     */
    public RosterView roster(String homeworkId) {
        Notification homework = requireHomework(homeworkId);
        List<Student> students = studentsForHomework(homework);
        Map<String, HomeworkCompletion.Entry> byStudent = entryIndex(homeworkId);

        List<RosterStudent> roster = students.stream()
                .map(s -> {
                    HomeworkCompletion.Entry e = byStudent.get(s.getStudentId());
                    return new RosterStudent(
                            s.getStudentId(),
                            fullName(s),
                            s.getRollNumber(),
                            e != null ? e.getStatus() : null,
                            e != null ? e.getRemark() : null,
                            e != null ? e.getMarkedAt() : null);
                })
                .sorted(RosterStudent.BY_ROLL_THEN_NAME)
                .collect(Collectors.toList());

        int doneCount = (int) roster.stream().filter(r -> r.status() == Status.DONE).count();
        return new RosterView(homeworkId, roster, doneCount);
    }

    /**
     * Single-student "did I do it?" lookup — resolves the caller's
     * userId to their studentId, then checks the completion doc's
     * entries. Returns false unless the entry is explicitly DONE
     * (HALF and PENDING both count as "not fully done" for the
     * student's own status chip).
     */
    public boolean isDoneForUser(String homeworkId, String userId) {
        String studentId = studentIdForUser(userId);
        if (studentId == null) return false;
        return completionRepository.findByHomeworkId(homeworkId)
                .map(c -> c.getEntries().stream()
                        .anyMatch(e -> studentId.equals(e.getStudentId()) && e.getStatus() == Status.DONE))
                .orElse(false);
    }

    /**
     * Batched status map — feeds the student's Homework list rows and
     * the "today's pending count" dashboard tile without N+1 reads.
     * Key is homeworkId, value is true when explicitly DONE.
     */
    public Map<String, Boolean> doneStatusForUser(Collection<String> homeworkIds, String userId) {
        if (homeworkIds == null || homeworkIds.isEmpty()) return Collections.emptyMap();
        String studentId = studentIdForUser(userId);
        Map<String, Boolean> out = new HashMap<>();
        for (String id : homeworkIds) out.put(id, false);
        if (studentId == null) return out;
        completionRepository.findByHomeworkIdIn(homeworkIds).forEach(c -> {
            boolean done = c.getEntries().stream()
                    .anyMatch(e -> studentId.equals(e.getStudentId()) && e.getStatus() == Status.DONE);
            out.put(c.getHomeworkId(), done);
        });
        return out;
    }

    /**
     * Richer batched status map — returns the actual {@link Status}
     * enum name (DONE / HALF / PENDING) or null when the teacher has
     * never touched that student. The student's Homework list uses
     * this to distinguish "not marked yet" from "explicitly marked
     * not done" so the chip can read "Not done" (nudged) instead of
     * a generic "Pending".
     */
    public Map<String, String> statusForUser(Collection<String> homeworkIds, String userId) {
        if (homeworkIds == null || homeworkIds.isEmpty()) return Collections.emptyMap();
        String studentId = studentIdForUser(userId);
        Map<String, String> out = new HashMap<>();
        for (String id : homeworkIds) out.put(id, null);
        if (studentId == null) return out;
        completionRepository.findByHomeworkIdIn(homeworkIds).forEach(c -> {
            c.getEntries().stream()
                    .filter(e -> studentId.equals(e.getStudentId()))
                    .findFirst()
                    .ifPresent(e -> out.put(c.getHomeworkId(), e.getStatus() != null ? e.getStatus().name() : null));
        });
        return out;
    }

    /**
     * Teacher accordion feed — per homework, the list of students who
     * haven't been marked DONE. HALF and never-touched entries are
     * both included ("not fully done"). Sorted by roll number so the
     * order stays stable across reloads. Batched so the Homework list
     * page can render an inline "not done" panel on every card with a
     * single request instead of one per card.
     */
    public Map<String, List<UndoneStudent>> undoneForHomeworks(Collection<String> homeworkIds) {
        Map<String, List<UndoneStudent>> out = new HashMap<>();
        if (homeworkIds == null || homeworkIds.isEmpty()) return out;
        for (String id : homeworkIds) out.put(id, Collections.emptyList());
        for (String id : homeworkIds) {
            RosterView view = roster(id);
            List<UndoneStudent> undone = view.students().stream()
                    .filter(s -> s.status() != Status.DONE)
                    .map(s -> new UndoneStudent(
                            s.studentId(), s.fullName(), s.rollNumber(),
                            s.status() != null ? s.status().name() : null))
                    .toList();
            out.put(id, undone);
        }
        return out;
    }

    /** Look up the studentId for a given userId — 1:1 mapping the app
     *  guarantees when a Student record is provisioned. Null when the
     *  caller isn't a student (parent, teacher, admin). */
    private String studentIdForUser(String userId) {
        if (userId == null || userId.isBlank()) return null;
        return studentRepository.findByUserIdAndDeletedAtIsNull(userId)
                .map(Student::getStudentId)
                .orElse(null);
    }

    // ── Writes ───────────────────────────────────────────────────

    /** Single-student mark used by the legacy per-row toggle endpoint. */
    public void mark(String homeworkId, String studentId, Status status, String markedBy) {
        Notification homework = requireHomework(homeworkId);
        HomeworkCompletion doc = completionRepository.findByHomeworkId(homeworkId)
                .orElseGet(() -> newDocFor(homework));

        Instant now = Instant.now();
        Optional<HomeworkCompletion.Entry> existing = doc.getEntries().stream()
                .filter(e -> studentId.equals(e.getStudentId()))
                .findFirst();
        if (existing.isPresent()) {
            HomeworkCompletion.Entry e = existing.get();
            e.setStatus(status);
            e.setMarkedBy(markedBy);
            e.setMarkedAt(now);
        } else {
            doc.getEntries().add(new HomeworkCompletion.Entry(studentId, status, null, markedBy, now));
        }
        completionRepository.save(doc);
    }

    /**
     * Batch save from the teacher's Roster page — every entry the
     * teacher touched arrives in one payload. Persists to the single
     * completion doc atomically (all inside one save call).
     */
    public void batchSave(String homeworkId, List<BatchEntry> entries, String markedBy) {
        if (entries == null || entries.isEmpty()) return;
        Notification homework = requireHomework(homeworkId);
        HomeworkCompletion doc = completionRepository.findByHomeworkId(homeworkId)
                .orElseGet(() -> newDocFor(homework));

        Instant now = Instant.now();
        Map<String, HomeworkCompletion.Entry> byStudent = new LinkedHashMap<>();
        for (HomeworkCompletion.Entry e : doc.getEntries()) byStudent.put(e.getStudentId(), e);

        for (BatchEntry b : entries) {
            HomeworkCompletion.Entry existing = byStudent.get(b.studentId());
            if (existing != null) {
                existing.setStatus(b.status());
                existing.setRemark(b.remark());
                existing.setMarkedBy(markedBy);
                existing.setMarkedAt(now);
            } else {
                HomeworkCompletion.Entry fresh = new HomeworkCompletion.Entry(
                        b.studentId(), b.status(), b.remark(), markedBy, now);
                doc.getEntries().add(fresh);
                byStudent.put(b.studentId(), fresh);
            }
        }
        completionRepository.save(doc);
    }

    /** Payload row for {@link #batchSave}. */
    public record BatchEntry(String studentId, Status status, String remark) {}

    /**
     * Fire a reminder Notification to every student in the roster who
     * is explicitly PENDING (not DONE, not HALF). HALF-done students
     * DON'T get a reminder — they've made an effort. Returns the
     * count of students actually notified.
     */
    public int notifyUndone(String homeworkId, String senderUserId) {
        Notification homework = requireHomework(homeworkId);
        RosterView view = roster(homeworkId);
        List<RosterStudent> undone = view.students().stream()
                .filter(s -> s.status() == Status.PENDING)
                .toList();
        if (undone.isEmpty()) return 0;

        // Map studentIds → userIds so the reminder targets the right
        // login accounts (INDIVIDUAL notifications key on userId).
        List<String> studentIds = undone.stream().map(RosterStudent::studentId).toList();
        List<Student> students = studentRepository.findByStudentIdInAndDeletedAtIsNull(studentIds);
        List<String> userIds = students.stream()
                .map(Student::getUserId)
                .filter(id -> id != null && !id.isBlank())
                .toList();
        if (userIds.isEmpty()) return 0;

        // Reminder body carries both the original title and its full
        // body so the student can act on the reminder without opening
        // the earlier notification. Original body is optional-safe —
        // if the sender left it blank we just show the title line.
        // Wipe any earlier reminder for THIS homework so the student's
        // inbox doesn't accumulate one "Homework not done" per teacher
        // click. Each notify creates exactly one live reminder with a
        // fresh recipient list.
        notificationRepository.deleteByRemindsHomeworkId(homeworkId);

        Notification reminder = new Notification();
        reminder.setTitle("Homework not done");
        StringBuilder body = new StringBuilder("Please complete: ").append(homework.getTitle());
        String originalBody = homework.getBody();
        if (originalBody != null && !originalBody.isBlank()) {
            body.append("\n\n").append(originalBody);
        }
        reminder.setBody(body.toString());
        reminder.setType(Notification.NotificationType.HOMEWORK);
        reminder.setChannel(homework.getChannel() != null ? homework.getChannel() : Notification.Channel.IN_APP);
        reminder.setRecipientType(Notification.RecipientType.INDIVIDUAL);
        reminder.setRecipientIds(userIds);
        // Backlink so subsequent notifies can find + replace this
        // reminder, and so the teacher's own list can hide reminders.
        reminder.setRemindsHomeworkId(homeworkId);
        notificationService.send(reminder, senderUserId);
        return userIds.size();
    }

    // ── Helpers ──────────────────────────────────────────────────

    private Notification requireHomework(String homeworkId) {
        Notification n = notificationRepository.findById(homeworkId)
                .orElseThrow(() -> new ResourceNotFoundException("Homework not found: " + homeworkId));
        if (n.getType() != Notification.NotificationType.HOMEWORK) {
            throw new BusinessException("Notification " + homeworkId + " is not homework.");
        }
        return n;
    }

    /**
     * Resolve the students who should be in the completion roster for
     * this homework. Order of preference:
     *   1. Explicit recipientIds (INDIVIDUAL sends) — the list IS the roster.
     *   2. CLASS + specific section — enumerate that section's students.
     *   3. CLASS only (legacy / whole-class sends) — enumerate every
     *      section on the class. Rare but handled so old docs still work.
     */
    private List<Student> studentsForHomework(Notification homework) {
        if (homework.getRecipientType() == Notification.RecipientType.INDIVIDUAL
                && homework.getRecipientIds() != null && !homework.getRecipientIds().isEmpty()) {
            List<String> ids = homework.getRecipientIds();
            List<Student> byStudent = studentRepository.findByStudentIdInAndDeletedAtIsNull(ids);
            if (!byStudent.isEmpty()) return byStudent;
            return studentRepository.findByUserIdInAndDeletedAtIsNull(ids);
        }
        String classId = homework.getRecipientClassId();
        String sectionId = homework.getRecipientSectionId();
        if (classId != null && sectionId != null && !sectionId.isBlank()) {
            return studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(classId, sectionId);
        }
        if (classId != null) {
            return studentRepository.findAllByClassIdAndDeletedAtIsNull(classId);
        }
        return Collections.emptyList();
    }

    private Map<String, HomeworkCompletion.Entry> entryIndex(String homeworkId) {
        return completionRepository.findByHomeworkId(homeworkId)
                .map(c -> {
                    Map<String, HomeworkCompletion.Entry> m = new LinkedHashMap<>();
                    for (HomeworkCompletion.Entry e : c.getEntries()) {
                        m.put(e.getStudentId(), e);
                    }
                    return m;
                })
                .orElse(Collections.emptyMap());
    }

    private HomeworkCompletion newDocFor(Notification homework) {
        HomeworkCompletion doc = new HomeworkCompletion();
        doc.setCompletionId(UUID.randomUUID().toString());
        doc.setHomeworkId(homework.getNotificationId());
        doc.setClassId(homework.getRecipientClassId());
        doc.setSectionId(homework.getRecipientSectionId());
        doc.setEntries(new ArrayList<>());
        return doc;
    }

    private static String fullName(Student s) {
        String f = s.getFirstName() != null ? s.getFirstName() : "";
        String l = s.getLastName() != null ? s.getLastName() : "";
        String joined = (f + " " + l).trim();
        return joined.isEmpty() ? (s.getAdmissionNumber() != null ? s.getAdmissionNumber() : s.getStudentId()) : joined;
    }

    // ── DTOs returned to the controller ──────────────────────────

    public record RosterView(String homeworkId, List<RosterStudent> students, int doneCount) {}

    public record RosterStudent(String studentId, String fullName, String rollNumber, Status status, String remark, Instant markedAt) {
        public static final java.util.Comparator<RosterStudent> BY_ROLL_THEN_NAME =
                java.util.Comparator
                        .comparing(RosterStudent::rollNumber, java.util.Comparator.nullsLast(String::compareTo))
                        .thenComparing(RosterStudent::fullName, java.util.Comparator.nullsLast(String::compareTo));
    }

    /** Compact per-student row for the teacher accordion — status is
     *  {@code null} for never-touched entries so the frontend can
     *  render "Pending" vs the explicit HALF/PENDING distinction. */
    public record UndoneStudent(String studentId, String fullName, String rollNumber, String status) {}
}
