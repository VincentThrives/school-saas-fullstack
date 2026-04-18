package com.saas.school.modules.notification.service;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.repository.NotificationRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.model.User;
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

    public Notification send(Notification req, String sentBy) {
        req.setNotificationId(UUID.randomUUID().toString());
        req.setCreatedBy(sentBy);
        req.setSentAt(Instant.now());
        req.setReadBy(new ArrayList<>());
        Notification saved = notificationRepository.save(req);
        if (req.getChannel() == Notification.Channel.EMAIL
                || req.getChannel() == Notification.Channel.BOTH) {
            sendEmailAsync(saved);
        }
        return saved;
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
