package com.saas.school.modules.notification.service;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.repository.NotificationRepository;
import com.saas.school.modules.push.service.PushNotificationService;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private JavaMailSender mailSender;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private PushNotificationService pushService;

    public Notification send(Notification req, String sentBy) {
        req.setNotificationId(UUID.randomUUID().toString());
        req.setCreatedBy(sentBy);
        req.setSentAt(Instant.now());
        req.setReadBy(new ArrayList<>());
        // Stamp the sender's name on the body so recipients see who sent it
        // (e.g. "Come to class - Hemanth"). The same body flows into push +
        // email below, so they get the suffix too without separate plumbing.
        req.setBody(appendSenderSignature(req.getBody(), sentBy));
        Notification saved = notificationRepository.save(req);
        if (req.getChannel() == Notification.Channel.EMAIL
                || req.getChannel() == Notification.Channel.BOTH) {
            sendEmailAsync(saved);
        }

        // Push notifications: fire-and-forget so saving the notification
        // doesn't wait on Google's API. Sends to every recipient that has
        // a registered FCM device token; users without the app installed
        // are silently skipped (zero tokens → no-op).
        //
        // Every targeting mode is expanded into a concrete list of userIds
        // so Compose / Template flows (which use ROLE / CLASS / ALL) push
        // just like the auto-rule flow (which already uses INDIVIDUAL).
        // The in-app inbox is unaffected — we only use the expanded list
        // for FCM, the saved notification keeps its original targeting.
        try {
            List<String> pushTargets = expandRecipientsForPush(saved);
            if (!pushTargets.isEmpty()) {
                Map<String, String> data = new HashMap<>();
                data.put("notificationId", saved.getNotificationId());
                data.put("url", "/notifications");  // tap → open notifications page
                pushService.sendToUsers(pushTargets,
                        saved.getTitle() == null ? "New notification" : saved.getTitle(),
                        saved.getBody() == null ? "" : saved.getBody(),
                        data);
            }
        } catch (Exception e) {
            // Push must NEVER break notification creation.
            log.warn("Push send failed (notification still saved): {}", e.getMessage());
        }
        return saved;
    }

    /**
     * Resolve a notification's targeting into the concrete list of userIds
     * that should receive a push:
     *
     *   - INDIVIDUAL → use the recipientIds verbatim
     *   - ROLE       → every active user with that role
     *   - CLASS      → every student in the class + every teacher linked
     *                  to the class (class teacher / classIds / per-subject
     *                  assignments) — matches the in-app inbox visibility
     *                  rule in {@link #classIdsOf}
     *   - ALL        → every active (non-deleted) user in the tenant
     *
     * Returns an empty list when no targets resolve, which keeps the push
     * call a no-op rather than crashing on a null payload.
     */
    private List<String> expandRecipientsForPush(Notification n) {
        Set<String> ids = new LinkedHashSet<>();
        Notification.RecipientType type = n.getRecipientType();
        // No type set → fall back to whatever recipientIds the caller supplied.
        if (type == null || type == Notification.RecipientType.INDIVIDUAL) {
            if (n.getRecipientIds() != null) {
                n.getRecipientIds().stream().filter(Objects::nonNull).forEach(ids::add);
            }
            return new ArrayList<>(ids);
        }
        if (type == Notification.RecipientType.ROLE) {
            String roleStr = n.getRecipientRole();
            if (roleStr != null && !roleStr.isBlank()) {
                try {
                    UserRole role = UserRole.valueOf(roleStr);
                    userRepository.findAllByRoleAndDeletedAtIsNull(role).stream()
                            .map(User::getUserId).filter(Objects::nonNull).forEach(ids::add);
                } catch (IllegalArgumentException ex) {
                    log.warn("Notification {} targets unknown role '{}' — no push fan-out",
                            n.getNotificationId(), roleStr);
                }
            }
            return new ArrayList<>(ids);
        }
        if (type == Notification.RecipientType.CLASS) {
            String classId = n.getRecipientClassId();
            if (classId != null && !classId.isBlank()) {
                studentRepository.findAllByClassIdAndDeletedAtIsNull(classId).stream()
                        .map(Student::getUserId).filter(Objects::nonNull).forEach(ids::add);
                teacherRepository.findAllByAnyClassId(classId).stream()
                        .map(Teacher::getUserId).filter(Objects::nonNull).forEach(ids::add);
            }
            return new ArrayList<>(ids);
        }
        if (type == Notification.RecipientType.ALL) {
            userRepository.findAllByDeletedAtIsNull().stream()
                    .map(User::getUserId).filter(Objects::nonNull).forEach(ids::add);
            return new ArrayList<>(ids);
        }
        return new ArrayList<>(ids);
    }

    /** List notifications visible to the logged-in user (all four targeting modes). */
    public Page<Notification> listForUser(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("sentAt").descending());
        String role = roleOf(userId);
        Collection<String> classIds = classIdsOf(userId);
        return notificationRepository.findForUser(userId, role, classIds, pageable);
    }

    /** History: notifications the logged-in user has sent. */
    public Page<Notification> listSentBy(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return notificationRepository.findByCreatedByOrderBySentAtDesc(userId, pageable);
    }

    public void markRead(String notificationId, String userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getReadBy() == null) n.setReadBy(new ArrayList<>());
            if (!n.getReadBy().contains(userId)) {
                n.getReadBy().add(userId);
                notificationRepository.save(n);
            }
        });
    }

    public long countUnread(String userId) {
        String role = roleOf(userId);
        Collection<String> classIds = classIdsOf(userId);
        return notificationRepository.findUnreadForUser(userId, role, classIds).size();
    }

    // ── helpers ────────────────────────────────────────────────

    private String roleOf(String userId) {
        return userRepository.findById(userId)
                .map(User::getRole)
                .map(Enum::name)
                .orElse("");
    }

    /**
     * Append "- &lt;Sender Name&gt;" to the notification body so recipients
     * see who sent it. Skips appending when:
     * <ul>
     *   <li>the sender's user record can't be resolved (anonymous / service
     *       account — better to send no signature than "- Unknown"),</li>
     *   <li>the body already ends with the same signature (double-send,
     *       resend, or a server retry).</li>
     * </ul>
     *
     * <p>Output uses a newline separator so the signature stays visually
     * distinct in both the in-app inbox and the FCM push body.
     */
    private String appendSenderSignature(String body, String senderUserId) {
        if (senderUserId == null || senderUserId.isBlank()) return body;
        User sender = userRepository.findById(senderUserId).orElse(null);
        if (sender == null) return body;
        String name = displayName(sender);
        if (name == null) return body;
        String signature = "- " + name;
        String safeBody = (body == null) ? "" : body.trim();
        // Avoid the double-signature case (resend, server retry, etc.).
        if (safeBody.endsWith(signature)) return safeBody;
        return safeBody.isEmpty() ? signature : safeBody + "\n" + signature;
    }

    /** Best-effort "Firstname Lastname" with fallbacks. Returns null when
     *  even the email is missing — caller skips the signature in that case. */
    private String displayName(User u) {
        if (u == null) return null;
        String first = u.getFirstName() == null ? "" : u.getFirstName().trim();
        String last  = u.getLastName()  == null ? "" : u.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (u.getEmail() != null && !u.getEmail().isBlank()) return u.getEmail();
        return null;
    }

    /**
     * The classIds a given user "belongs to" for CLASS-targeted notifications.
     *   - Student → the class they're enrolled in
     *   - Teacher → every class in their subject assignments (plus class-teacher class)
     *   - Others → empty
     */
    private Collection<String> classIdsOf(String userId) {
        Set<String> out = new HashSet<>();
        studentRepository.findByUserIdAndDeletedAtIsNull(userId).ifPresent(s -> {
            if (s.getClassId() != null) out.add(s.getClassId());
        });
        teacherRepository.findByUserIdAndDeletedAtIsNull(userId).ifPresent((Teacher t) -> {
            if (t.getClassTeacherOfClassId() != null) out.add(t.getClassTeacherOfClassId());
            if (t.getClassIds() != null) out.addAll(t.getClassIds());
            if (t.getClassSubjectAssignments() != null) {
                t.getClassSubjectAssignments().forEach(a -> {
                    if (a.getClassId() != null) out.add(a.getClassId());
                });
            }
        });
        // Always include a harmless sentinel so Mongo's $in never gets an empty list for non-class users.
        if (out.isEmpty()) out.add("__none__");
        return out;
    }

    @Async
    public void sendEmailAsync(Notification n) {
        if (n.getRecipientIds() == null) return;
        // In production: look up emails from user service and send
        log.info("Would send email notification '{}' to {} recipients", n.getTitle(), n.getRecipientIds().size());
    }
}
