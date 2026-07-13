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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
    @Autowired private MongoTemplate mongoTemplate;

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
        boolean alreadyEveryone = false;

        // No type set → fall back to whatever recipientIds the caller supplied.
        if (type == null || type == Notification.RecipientType.INDIVIDUAL) {
            if (n.getRecipientIds() != null) {
                n.getRecipientIds().stream().filter(Objects::nonNull).forEach(ids::add);
            }
        } else if (type == Notification.RecipientType.ROLE) {
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
        } else if (type == Notification.RecipientType.CLASS) {
            String classId = n.getRecipientClassId();
            if (classId != null && !classId.isBlank()) {
                studentRepository.findAllByClassIdAndDeletedAtIsNull(classId).stream()
                        .map(Student::getUserId).filter(Objects::nonNull).forEach(ids::add);
                teacherRepository.findAllByAnyClassId(classId).stream()
                        .map(Teacher::getUserId).filter(Objects::nonNull).forEach(ids::add);
            }
        } else if (type == Notification.RecipientType.ALL) {
            userRepository.findAllByDeletedAtIsNull().stream()
                    .map(User::getUserId).filter(Objects::nonNull).forEach(ids::add);
            alreadyEveryone = true;
        }

        // SCHOOL_ADMIN / PRINCIPAL get a supervision-channel push for every
        // BROADCAST (ROLE / CLASS) — so a single-class homework note still
        // pings them. We skip:
        //   - INDIVIDUAL: usually a per-student message (or a bulk fan-out
        //     like Publish Result that creates one doc per student); the
        //     admin inbox doesn't surface these, so don't push them either.
        //   - ALL: admins are already in the recipient set.
        boolean isBroadcast = type == Notification.RecipientType.ROLE
                || type == Notification.RecipientType.CLASS;
        if (isBroadcast && !alreadyEveryone) {
            addAdminAndPrincipalUserIds(ids);
        }
        return new ArrayList<>(ids);
    }

    /** Append SCHOOL_ADMIN + PRINCIPAL user ids to the set in place.
     *  Used so the supervision channel sees every notification regardless
     *  of how narrow the audience was. */
    private void addAdminAndPrincipalUserIds(Set<String> ids) {
        try {
            userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.SCHOOL_ADMIN).stream()
                    .map(User::getUserId).filter(Objects::nonNull).forEach(ids::add);
            userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.PRINCIPAL).stream()
                    .map(User::getUserId).filter(Objects::nonNull).forEach(ids::add);
        } catch (Exception e) {
            // Don't break a regular send just because admin fan-out failed.
            log.warn("Admin / principal push fan-out failed: {}", e.getMessage());
        }
    }

    /** List notifications visible to the logged-in user (all four targeting modes).
     *  SCHOOL_ADMIN / PRINCIPAL see every BROADCAST in the tenant
     *  (ALL / ROLE / CLASS) so they can supervise the channel, plus any
     *  INDIVIDUAL notification addressed to them personally. Per-student
     *  bulk fan-outs (Publish Result for 50 students, etc.) stop flooding
     *  the supervision inbox. */
    public Page<Notification> listForUser(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("sentAt").descending());
        String role = roleOf(userId);
        if (isAdminLikeRole(role)) {
            return notificationRepository.findForAdmin(userId, pageable);
        }
        Collection<String> classIds = classIdsOf(userId);
        Collection<String> sectionIds = sectionIdsOf(userId);
        return notificationRepository.findForUser(userId, role, classIds, sectionIds, pageable);
    }

    /**
     * Same audience-scoped listing as {@link #listForUser}, but with two
     * optional server-side filters:
     * <ul>
     *   <li>{@code type} — restrict to a notification type (e.g. HOMEWORK).</li>
     *   <li>{@code date} — restrict to notifications sent on that local day.</li>
     * </ul>
     * Both null → equivalent to the unfiltered path (used by the Homework
     * page). Filters happen at Mongo query time so the payload stays
     * small even as a school accumulates thousands of notifications.
     */
    public Page<Notification> listForUserFiltered(
            String userId, int page, int size, String type, LocalDate date) {
        return listForUserFiltered(userId, page, size, type, date, date);
    }

    /** Range variant — {@code dateFrom} inclusive, {@code dateTo}
     *  inclusive. When both are equal, behaves like the single-date
     *  filter above. Either may be null to leave that end open. */
    public Page<Notification> listForUserFiltered(
            String userId, int page, int size, String type, LocalDate dateFrom, LocalDate dateTo) {
        // Fast path: no filters requested → reuse the existing method so
        // caching and query planning stay identical for legacy callers.
        if ((type == null || type.isBlank()) && dateFrom == null && dateTo == null) {
            return listForUser(userId, page, size);
        }

        String role = roleOf(userId);
        Collection<String> classIds = classIdsOf(userId);
        Collection<String> sectionIds = sectionIdsOf(userId);

        Criteria criteria;
        if (isAdminLikeRole(role)) {
            // Admin sees every broadcast + INDIVIDUAL where they're a target.
            criteria = new Criteria().orOperator(
                    Criteria.where("recipientType").is("ALL"),
                    Criteria.where("recipientType").is("ROLE"),
                    Criteria.where("recipientType").is("CLASS"),
                    new Criteria().andOperator(
                            Criteria.where("recipientType").is("INDIVIDUAL"),
                            Criteria.where("recipientIds").in(userId)));
        } else {
            // CLASS branch scopes to the user's sections — a homework sent
            // to "10-A" doesn't leak to "10-B" students who share classId.
            // Notifications with no section stay visible to the whole class
            // (matches the class-wide send from the compose form).
            Criteria classBranch = new Criteria().andOperator(
                    Criteria.where("recipientType").is("CLASS"),
                    Criteria.where("recipientClassId").in(classIds),
                    new Criteria().orOperator(
                            Criteria.where("recipientSectionId").is(null),
                            Criteria.where("recipientSectionId").in(sectionIds)));
            criteria = new Criteria().orOperator(
                    Criteria.where("recipientType").is("ALL"),
                    new Criteria().andOperator(
                            Criteria.where("recipientType").is("ROLE"),
                            Criteria.where("recipientRole").is(role)),
                    new Criteria().andOperator(
                            Criteria.where("recipientType").is("INDIVIDUAL"),
                            Criteria.where("recipientIds").in(userId)),
                    classBranch);
        }

        List<Criteria> and = new ArrayList<>();
        and.add(criteria);
        if (type != null && !type.isBlank()) {
            and.add(Criteria.where("type").is(type));
        }
        if (dateFrom != null || dateTo != null) {
            // Day boundaries in the JVM's default zone — matches how the
            // Angular date picker sends plain yyyy-MM-dd strings. When
            // both bounds are supplied it's an inclusive range; single
            // bound → open on the other side (legacy single-date calls
            // send from == to so behaviour is identical).
            Criteria at = Criteria.where("sentAt");
            if (dateFrom != null) {
                Instant start = dateFrom.atStartOfDay(ZoneId.systemDefault()).toInstant();
                at = at.gte(start);
            }
            if (dateTo != null) {
                Instant end = dateTo.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
                at = at.lt(end);
            }
            and.add(at);
        }
        // Hide reminder rows from the student's Homework list too —
        // they still land in the general notifications bell, but the
        // Homework page should only show original assignments. The
        // reminder's status is reflected on the ORIGINAL row's chip
        // via remindsHomeworkId, so the student never has to guess
        // "which one is the real one".
        and.add(new Criteria().orOperator(
                Criteria.where("remindsHomeworkId").is(null),
                Criteria.where("remindsHomeworkId").exists(false)));

        Query q = new Query(new Criteria().andOperator(and.toArray(new Criteria[0])))
                .with(PageRequest.of(page, size, Sort.by("sentAt").descending()));

        long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), Notification.class);
        List<Notification> content = mongoTemplate.find(q, Notification.class);
        return new PageImpl<>(content, PageRequest.of(page, size), total);
    }

    /** History: notifications the logged-in user has sent. */
    public Page<Notification> listSentBy(String userId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return notificationRepository.findByCreatedByOrderBySentAtDesc(userId, pageable);
    }

    /**
     * Same as {@link #listSentBy} but scoped with the two optional
     * server-side filters (type + date). Feeds the teacher Homework
     * page which wants "homework I sent on this date". Both null →
     * falls back to the unfiltered path so legacy callers stay
     * identical.
     */
    public Page<Notification> listSentByFiltered(
            String userId, int page, int size, String type, LocalDate date) {
        return listSentByFiltered(userId, page, size, type, date, date);
    }

    /** Range variant — matches the semantics of the range overload of
     *  {@link #listForUserFiltered}. */
    public Page<Notification> listSentByFiltered(
            String userId, int page, int size, String type, LocalDate dateFrom, LocalDate dateTo) {
        if ((type == null || type.isBlank()) && dateFrom == null && dateTo == null) {
            return listSentBy(userId, page, size);
        }
        List<Criteria> and = new ArrayList<>();
        and.add(Criteria.where("createdBy").is(userId));
        if (type != null && !type.isBlank()) {
            and.add(Criteria.where("type").is(type));
        }
        if (dateFrom != null || dateTo != null) {
            Criteria at = Criteria.where("sentAt");
            if (dateFrom != null) {
                Instant start = dateFrom.atStartOfDay(ZoneId.systemDefault()).toInstant();
                at = at.gte(start);
            }
            if (dateTo != null) {
                Instant end = dateTo.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
                at = at.lt(end);
            }
            and.add(at);
        }
        // Hide reminders from the teacher's own Homework list — they
        // want to see the assignments they posted, not the "Homework
        // not done" nudges those assignments spawned via Save & Notify.
        // Legacy notifications with no remindsHomeworkId field still
        // pass through (the null-match covers both missing-field and
        // explicit-null docs).
        and.add(new Criteria().orOperator(
                Criteria.where("remindsHomeworkId").is(null),
                Criteria.where("remindsHomeworkId").exists(false)));
        Query q = new Query(new Criteria().andOperator(and.toArray(new Criteria[0])))
                .with(PageRequest.of(page, size, Sort.by("sentAt").descending()));
        long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), Notification.class);
        List<Notification> content = mongoTemplate.find(q, Notification.class);
        return new PageImpl<>(content, PageRequest.of(page, size), total);
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
        if (isAdminLikeRole(role)) {
            // Admin badge tracks broadcasts + individually-addressed
            // notifications — matches {@link #listForUser} so the badge
            // and inbox stay in lockstep.
            return notificationRepository.countUnreadForAdmin(userId);
        }
        Collection<String> classIds = classIdsOf(userId);
        Collection<String> sectionIds = sectionIdsOf(userId);
        return notificationRepository.findUnreadForUser(userId, role, classIds, sectionIds).size();
    }

    /** True for tenant-scoped supervisor roles that see every notification. */
    private boolean isAdminLikeRole(String role) {
        return "SCHOOL_ADMIN".equals(role) || "PRINCIPAL".equals(role);
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

    /**
     * Section IDs the user belongs to, used alongside {@link #classIdsOf}
     * so a homework sent to "10-A" doesn't leak to students in "10-B"
     * who happen to share the same classId. Students have exactly one
     * section; teachers can span many (class-teacher + subject
     * assignments across sections).
     *
     * <p>Notifications with {@code recipientSectionId == null} still
     * reach every section on the class — that's the class-wide send —
     * which the query handles via a null-OR-in-list branch. This
     * helper just needs to return the list of sections that ARE ours;
     * legacy targeting stays intact.</p>
     */
    private Collection<String> sectionIdsOf(String userId) {
        Set<String> out = new HashSet<>();
        studentRepository.findByUserIdAndDeletedAtIsNull(userId).ifPresent(s -> {
            if (s.getSectionId() != null) out.add(s.getSectionId());
        });
        teacherRepository.findByUserIdAndDeletedAtIsNull(userId).ifPresent((Teacher t) -> {
            if (t.getClassTeacherOfSectionId() != null) out.add(t.getClassTeacherOfSectionId());
            if (t.getClassSubjectAssignments() != null) {
                t.getClassSubjectAssignments().forEach(a -> {
                    if (a.getSectionId() != null) out.add(a.getSectionId());
                });
            }
        });
        // Sentinel keeps Mongo's $in happy for non-class users.
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
