package com.saas.school.modules.sms.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.sms.config.SmsConfig;
import com.saas.school.modules.sms.dto.AbsentTodayDto;
import com.saas.school.modules.sms.dto.SendAbsentTodayResponse;
import com.saas.school.modules.sms.dto.SendCustomNoticeRequest;
import com.saas.school.modules.sms.dto.SendCustomNoticeResponse;
import com.saas.school.modules.sms.dto.UpdateTenantSmsSettingsRequest;
import com.saas.school.modules.sms.model.SmsAuditLog;
import com.saas.school.modules.sms.model.SmsTrigger;
import com.saas.school.modules.sms.model.TenantSmsSettings;
import com.saas.school.modules.sms.repository.CentralTenantSmsSettingsStore;
import com.saas.school.modules.sms.repository.SmsAuditLogRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;

/**
 * Orchestration service for SMS dispatch. Every code path that wants
 * to send SMS goes through this service — never the provider directly.
 *
 * The 4-layer gate (executed in order, fail-fast):
 *   1. Global kill-switch ({@code SMS_ENABLED} env var)
 *   2. Per-tenant enabled flag (SUPER_ADMIN controls this)
 *   3. Per-trigger enabled flag (absence / result / custom)
 *   4. Per-tenant monthly budget cap
 *
 * If any layer rejects, an {@link SmsAuditLog} row is written with
 * status SKIPPED and a clear reason — so the audit log shows WHY
 * an expected SMS didn't go out, which is gold for debugging.
 *
 * Every actual send is async ({@code @Async}) — the caller (e.g.
 * AttendanceService.fireAbsenceAlerts) returns immediately and the
 * SMS happens in the background. SMS failure NEVER breaks the parent
 * operation (mark-absent still succeeds even if MSG91 is unreachable).
 */
@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    @Autowired private SmsConfig smsConfig;
    @Autowired private SmsProvider smsProvider;
    @Autowired private PhoneNumberService phoneNumberService;
    @Autowired private SmsAuditLogRepository auditRepo;
    /** Central-DB-bound store. We do NOT use a Spring Data repository here
     *  because the tenant-routing factory would send tenant reads to the
     *  per-tenant DB while Super Admin writes land in {@code saas_central}.
     *  See {@link CentralTenantSmsSettingsStore} for the full rationale. */
    @Autowired private CentralTenantSmsSettingsStore settingsRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentsAttendanceRepository attendanceRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private AuditService auditService;

    // ── Public API ─────────────────────────────────────────────

    /**
     * Fan out a templated SMS to one or more recipients identified by
     * userId. Phone numbers are resolved from User.phone, normalised,
     * deduped, then individually dispatched.
     *
     * Async — caller doesn't wait. SmsService catches all exceptions
     * internally so the calling business operation can't be broken
     * by a misbehaving SMS gateway.
     *
     * <p>Back-compat overload — delegates to the 7-arg version with
     * no extra phones. Existing call sites (e.g. SmsService.sendCustomNotice)
     * that work purely in userId terms keep using this.</p>
     *
     * @param trigger     The event class (ABSENCE_ALERT, etc.)
     * @param userIds     List of User._ids to send to. Users without
     *                    a valid phone are skipped silently (logged).
     * @param variables   Template variables — keys match the registered
     *                    DLT template ("var1", "var2", "var3" for
     *                    ABSENCE_ALERT). Values are stamped verbatim.
     * @param triggeredBy User._id of the actor, or "SYSTEM" for auto-rules
     * @param entityType  Domain entity this SMS is about — for audit traceability
     * @param entityId    Specific entity id (e.g. studentId for absence)
     */
    public void dispatchAsync(SmsTrigger trigger,
                              List<String> userIds,
                              Map<String, String> variables,
                              String triggeredBy,
                              String entityType,
                              String entityId) {
        dispatchAsync(trigger, userIds, null, variables, triggeredBy, entityType, entityId);
    }

    /**
     * Same as the 6-arg {@link #dispatchAsync(SmsTrigger, List, Map, String, String, String)}
     * but accepts an additional {@code extraPhones} list of raw phone
     * numbers that are NOT linked to any User record.
     *
     * <p>This was added to fix the absence-alert path. Students are
     * created with the parent's phone stored as a free-text field on
     * {@code Student.parentPhone} — no Parent User record is auto-created.
     * The userId → User.phone lookup therefore finds nothing for those
     * parents, and the SMS silently drops. Pass the raw {@code Student.parentPhone}
     * here and it goes through the same gate + dedupe + audit pipeline
     * as userId-resolved phones.</p>
     *
     * <p>Phone-level dedupe means a parent who has BOTH a Parent User
     * record (with phone) AND a value in {@code Student.parentPhone}
     * still gets exactly one SMS, regardless of which list they came in
     * through. Audit rows for extraPhones recipients have a null
     * {@code recipientUserId} and role {@code PARENT_RAW} so they're
     * distinguishable in the log from user-resolved sends.</p>
     */
    @Async
    public void dispatchAsync(SmsTrigger trigger,
                              List<String> userIds,
                              List<String> extraPhones,
                              Map<String, String> variables,
                              String triggeredBy,
                              String entityType,
                              String entityId) {
        String tenantId = TenantContext.getTenantId();
        try {
            // ── Layer 1: Global kill-switch
            if (!smsConfig.isEnabled()) {
                log.debug("SMS globally disabled — skipping {} for tenant {}", trigger, tenantId);
                return;
            }

            // ── Layer 2 + 3: Per-tenant + per-trigger enabled
            TenantSmsSettings settings = settingsRepo.findByTenantId(tenantId).orElse(null);
            if (settings == null || !settings.isEnabled()) {
                log.debug("SMS disabled for tenant {} — skipping {}", tenantId, trigger);
                return;
            }
            if (!settings.isTriggerEnabled(trigger)) {
                log.debug("Trigger {} disabled for tenant {} — skipping", trigger, tenantId);
                return;
            }

            // ── Layer 4: Monthly budget cap. Reset counter if month rolled.
            resetMonthlyCounterIfNeeded(settings);
            if (settings.getCostUsedThisMonth() >= settings.getMonthlyBudgetInr()) {
                log.warn("Tenant {} hit monthly SMS budget cap (₹{}). Skipping {}.",
                        tenantId, settings.getMonthlyBudgetInr(), trigger);
                // Log a SKIPPED row so the audit log shows the cap-hit story.
                writeSkipped(tenantId, trigger, variables, triggeredBy, entityType, entityId,
                        "Monthly budget cap reached");
                return;
            }

            // ── Template id lookup
            String templateId = templateIdFor(trigger);
            if (templateId == null || templateId.isBlank()) {
                log.warn("No DLT template id configured for trigger {} — skipping", trigger);
                writeSkipped(tenantId, trigger, variables, triggeredBy, entityType, entityId,
                        "DLT template not configured");
                return;
            }

            // ── Resolve userIds + extraPhones → phones, normalise, dedupe
            List<RecipientInfo> recipients = resolveRecipients(userIds, extraPhones);
            if (recipients.isEmpty()) {
                int uCount = userIds == null ? 0 : userIds.size();
                int pCount = extraPhones == null ? 0 : extraPhones.size();
                log.warn("No valid phone numbers among {} userIds + {} extraPhones for trigger {} — nothing to send",
                        uCount, pCount, trigger);
                // Write a SKIPPED audit row so the empty-recipient case
                // is visible in the SMS audit log (otherwise it's silent
                // and the admin has no clue why the SMS didn't go out).
                writeSkipped(tenantId, trigger, variables, triggeredBy, entityType, entityId,
                        "No recipients had a valid phone number");
                return;
            }

            // ── Dispatch one-by-one. Each call audited independently.
            for (RecipientInfo r : recipients) {
                // Re-check budget before each send (handles concurrent fan-out).
                if (settings.getCostUsedThisMonth() >= settings.getMonthlyBudgetInr()) {
                    writeSkipped(tenantId, trigger, variables, triggeredBy, entityType, entityId,
                            "Monthly budget cap reached mid-fan-out");
                    break;
                }
                sendOne(tenantId, settings, trigger, templateId, r, variables,
                        triggeredBy, entityType, entityId);
            }

        } catch (Exception e) {
            // Defence in depth — SMS must NEVER break the parent operation.
            log.error("SMS dispatch failed for trigger {} (tenant {}): {}",
                    trigger, tenantId, e.getMessage(), e);
        }
    }

    /**
     * Send a one-off test SMS to a specific phone number — used by the
     * "Send test SMS to my number" button on the school admin's settings
     * page. Bypasses the trigger-enabled check (so even when triggers
     * are off, admin can verify the pipeline) but STILL respects the
     * tenant-enabled + budget caps.
     */
    public SmsAuditLog sendTest(String phoneRaw, String requestingUserId) {
        String tenantId = TenantContext.getTenantId();
        if (!smsConfig.isEnabled()) {
            throw new BusinessException("SMS is globally disabled. Contact platform admin.");
        }
        TenantSmsSettings settings = settingsRepo.findByTenantId(tenantId).orElse(null);
        if (settings == null || !settings.isEnabled()) {
            throw new BusinessException("SMS is not enabled for this school.");
        }
        Optional<String> phone = phoneNumberService.normalize(phoneRaw);
        if (phone.isEmpty()) {
            throw new BusinessException("Invalid phone number — must be a 10-digit Indian mobile.");
        }
        String templateId = templateIdFor(SmsTrigger.ABSENCE_ALERT);
        if (templateId == null || templateId.isBlank()) {
            throw new BusinessException("Test SMS template not configured.");
        }

        // Render with a dummy student so the body is recognisable as a test.
        // Variable NAMES match the MSG91 ABSENCE_ALERT template:
        // "##student##", "##class##", "##date##". Mismatched keys silently
        // leave the slots blank in the delivered SMS.
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("student", "Test Student");
        vars.put("class", "Test Class");
        vars.put("date", "Test Date");

        RecipientInfo recipient = new RecipientInfo(phone.get(), requestingUserId, "ADMIN_TEST");
        return sendOne(tenantId, settings, SmsTrigger.ABSENCE_ALERT, templateId, recipient, vars,
                requestingUserId, "SmsTest", requestingUserId);
    }

    /**
     * Broadcast a custom SMS to a chosen audience inside the current tenant.
     *
     * <p>This is the school-admin-facing "send a custom message" flow.
     * Distinct from {@link #dispatchAsync} in that the trigger gating
     * happens here once (rather than per-recipient on a system rule fire),
     * and the recipient set is resolved up-front from the requested
     * {@link SendCustomNoticeRequest.Audience}:</p>
     *
     * <ul>
     *   <li>{@code ALL} — every active user with a phone (parents + staff)</li>
     *   <li>{@code ALL_STUDENTS} — parents linked on each student's record
     *       (falls back to the student's own User when no parent is set)</li>
     *   <li>{@code ALL_EMPLOYEES} — TEACHER + PRINCIPAL + SCHOOL_ADMIN</li>
     *   <li>{@code CLASS} — parents of students in the chosen class</li>
     * </ul>
     *
     * <p>The actual MSG91 fan-out runs async via
     * {@link #dispatchAsync(SmsTrigger, java.util.List, java.util.Map, String, String, String)}
     * — this method returns immediately after queuing, with the
     * pre-dedupe recipient count so the admin sees a useful confirmation.
     * Failures during dispatch are recorded in the audit log; this method
     * does not throw on per-recipient send failures.</p>
     *
     * <p>The 4-layer gate (global / tenant / trigger / budget) is enforced
     * inside {@code dispatchAsync}, so this method only validates the
     * minimum needed to give the admin a clear synchronous error. Trigger
     * gating happens here too so the admin sees "Custom notices are
     * disabled for your school" instead of a silent no-op.</p>
     */
    public SendCustomNoticeResponse sendCustomNotice(SendCustomNoticeRequest req, String adminUserId) {
        if (req == null || req.getMessage() == null || req.getMessage().isBlank()) {
            throw new BusinessException("Message is required.");
        }
        List<SendCustomNoticeRequest.Audience> audiences = req.getAudiences();
        if (audiences == null || audiences.isEmpty()) {
            throw new BusinessException("Pick at least one audience.");
        }
        if (audiences.contains(SendCustomNoticeRequest.Audience.CLASS)
                && (req.getClassId() == null || req.getClassId().isBlank())) {
            throw new BusinessException("Class is required when \"Particular class\" is picked.");
        }

        String tenantId = TenantContext.getTenantId();
        if (!smsConfig.isEnabled()) {
            throw new BusinessException("SMS is globally disabled. Contact platform admin.");
        }
        TenantSmsSettings settings = settingsRepo.findByTenantId(tenantId).orElse(null);
        if (settings == null || !settings.isEnabled()) {
            throw new BusinessException("SMS is not enabled for this school.");
        }
        if (!settings.isCustomNoticeEnabled()) {
            throw new BusinessException(
                "Custom notices are disabled for your school. Contact platform support to enable.");
        }

        List<String> userIds = resolveAudiences(audiences, req.getClassId());
        if (userIds.isEmpty()) {
            throw new BusinessException("No recipients matched the chosen audience(s).");
        }

        // Stamp the message body as var1. MSG91 will splice it into the
        // DLT-approved CUSTOM_NOTICE template (which adds the brand
        // suffix and any required wrapper). We don't render the template
        // here — that's MSG91's job at send time.
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("var1", req.getMessage().trim());

        // Compact label used both for the audit entityId and the response
        // payload so the frontend can echo "Queued to X recipients for
        // ALL_STUDENTS, ALL_EMPLOYEES" without doing its own enum→string
        // gymnastics.
        List<String> audienceNames = audiences.stream().map(Enum::name).toList();
        String audienceLabel = String.join(",", audienceNames);

        // Fan out — async, returns immediately. Each per-recipient send is
        // independently audited inside dispatchAsync.
        dispatchAsync(SmsTrigger.CUSTOM_NOTICE, userIds, vars, adminUserId,
                "CustomNotice", "broadcast-" + audienceLabel);

        auditService.log("SMS_CUSTOM_NOTICE", "CustomNotice", tenantId,
                "Broadcast queued by " + adminUserId + " audiences=" + audienceLabel
                        + (req.getClassId() != null ? " classId=" + req.getClassId() : "")
                        + " recipients=" + userIds.size());

        return new SendCustomNoticeResponse(audienceNames, userIds.size(), Instant.now());
    }

    /**
     * Audiences → unioned, deduped userId list.
     *
     * <p>Resolves each picked audience independently then unions them into
     * an order-preserving {@link LinkedHashSet} so the same userId can't
     * appear twice when audiences overlap (e.g. a teacher whose own child
     * is also a student in the school appearing in both {@code ALL_EMPLOYEES}
     * and {@code ALL_STUDENTS}). Phone-level dedupe still runs later in
     * {@link #resolveRecipients} — this just trims the obvious userId
     * duplicates upfront so we don't fetch the same User twice.</p>
     *
     * @param audiences the audiences picked in the UI
     * @param classId   required only when the list contains {@code CLASS}
     */
    private List<String> resolveAudiences(List<SendCustomNoticeRequest.Audience> audiences, String classId) {
        // LinkedHashSet → preserves the natural ordering (audience-by-audience)
        // while killing duplicate userIds across audience overlaps.
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (SendCustomNoticeRequest.Audience a : audiences) {
            ids.addAll(resolveOneAudience(a, classId));
        }
        return new ArrayList<>(ids);
    }

    /** Resolves a single audience to its userIds. */
    private List<String> resolveOneAudience(SendCustomNoticeRequest.Audience audience, String classId) {
        return switch (audience) {
            case ALL            -> collectUserIds(userRepository.findAllByDeletedAtIsNull());
            case ALL_STUDENTS   -> collectStudentParentUserIds(studentRepository.findByDeletedAtIsNull());
            case ALL_EMPLOYEES  -> {
                List<String> ids = new ArrayList<>();
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.TEACHER)));
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.PRINCIPAL)));
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.SCHOOL_ADMIN)));
                yield ids;
            }
            case CLASS          -> collectStudentParentUserIds(
                    studentRepository.findAllByClassIdAndDeletedAtIsNull(classId));
        };
    }

    /** Flatten a User list to its userIds, dropping nulls. */
    private List<String> collectUserIds(List<User> users) {
        if (users == null) return List.of();
        List<String> out = new ArrayList<>(users.size());
        for (User u : users) {
            if (u != null && u.getUserId() != null) out.add(u.getUserId());
        }
        return out;
    }

    /** Per-student: prefer the linked parentIds (real SMS recipient), but
     *  fall back to the student's own userId when no parent is recorded —
     *  better than silently dropping the student from the broadcast. */
    private List<String> collectStudentParentUserIds(List<Student> students) {
        if (students == null) return List.of();
        List<String> out = new ArrayList<>();
        for (Student s : students) {
            if (s == null) continue;
            List<String> parents = s.getParentIds();
            if (parents != null && !parents.isEmpty()) {
                out.addAll(parents);
            } else if (s.getUserId() != null) {
                out.add(s.getUserId());
            }
        }
        return out;
    }

    // ── Today's absence-alert manual flow ──────────────────────

    /** Today (in school local time — Asia/Kolkata). All "today" semantics
     *  in the SMS module funnel through this single helper so reset
     *  windows, budget months, and idempotency dedupe align. */
    private static LocalDate todayLocal() {
        return LocalDate.now(ZoneId.of("Asia/Kolkata"));
    }

    /**
     * Build the picker for the "Send today's absent SMS" page.
     *
     * <p>Walks every {@link StudentsAttendance} batch for today, collects
     * unique studentIds whose status is {@code ABSENT} across any period,
     * and resolves each one to a row with class label + masked parent
     * phone. Students who already had a SENT/DELIVERED/PENDING audit row
     * for ABSENCE_ALERT today are flagged {@code alreadySent} — the
     * frontend pre-unchecks them and shows a badge.</p>
     *
     * <p>Returns an empty list when no attendance has been recorded
     * today. Doesn't throw — empty is a legitimate state at the start
     * of a school day.</p>
     */
    public List<AbsentTodayDto> listAbsentToday() {
        String tenantId = TenantContext.getTenantId();
        LocalDate today = todayLocal();

        // 1) Walk today's attendance, build studentId → periods map.
        //    Day-wise marks (period 0) are tracked separately from
        //    period-wise marks so the UI can show the right hint.
        Map<String, Set<Integer>> studentToPeriods = new LinkedHashMap<>();
        Set<String> dayWiseAbsent = new HashSet<>();
        List<StudentsAttendance> batches = attendanceRepository.findByDate(today);
        for (StudentsAttendance batch : batches) {
            if (batch == null || batch.getEntries() == null) continue;
            int period = batch.getPeriodNumber();
            for (StudentsAttendance.StudentEntry e : batch.getEntries()) {
                if (e == null || !"ABSENT".equalsIgnoreCase(e.getStatus())) continue;
                String sid = e.getStudentId();
                if (sid == null) continue;
                if (period == 0) {
                    dayWiseAbsent.add(sid);
                } else {
                    studentToPeriods.computeIfAbsent(sid, k -> new TreeSet<>()).add(period);
                }
                // Make sure even day-wise-only students get a map entry so
                // the iteration order below covers everyone.
                studentToPeriods.putIfAbsent(sid, new TreeSet<>());
            }
        }
        if (studentToPeriods.isEmpty()) return List.of();

        // 2) Idempotency check — which of these studentIds already have a
        //    fresh SENT/PENDING absence-alert audit row from today?
        java.time.Instant todayStart = today.atStartOfDay(ZoneId.of("Asia/Kolkata")).toInstant();
        List<SmsAuditLog> existing = auditRepo.findExistingForEntities(
                tenantId, SmsTrigger.ABSENCE_ALERT, "AttendanceRecord",
                studentToPeriods.keySet(), todayStart);
        Set<String> alreadySentIds = new HashSet<>();
        for (SmsAuditLog log : existing) {
            if (log != null && log.getRelatedEntityId() != null) {
                alreadySentIds.add(log.getRelatedEntityId());
            }
        }

        // 3) Resolve each student to a DTO. Class labels cached locally
        //    so we don't re-fetch SchoolClass for siblings in the same class.
        Map<String, String> classLabelCache = new HashMap<>();
        List<AbsentTodayDto> out = new ArrayList<>(studentToPeriods.size());
        for (Map.Entry<String, Set<Integer>> entry : studentToPeriods.entrySet()) {
            String sid = entry.getKey();
            Student stu = studentRepository.findByStudentIdAndDeletedAtIsNull(sid).orElse(null);
            if (stu == null) continue;

            AbsentTodayDto dto = new AbsentTodayDto();
            dto.setStudentId(sid);
            dto.setStudentName(buildStudentName(stu));
            dto.setAdmissionNumber(stu.getAdmissionNumber());
            dto.setClassLabel(classLabelCache.computeIfAbsent(
                    keyFor(stu.getClassId(), stu.getSectionId()),
                    k -> resolveClassLabelFromStudent(stu)));
            dto.setParentName(stu.getParentName());

            String rawPhone = stu.getParentPhone();
            Optional<String> normalized = rawPhone == null
                    ? Optional.empty()
                    : phoneNumberService.normalize(rawPhone);
            dto.setHasValidPhone(normalized.isPresent());
            dto.setParentPhoneMasked(normalized.map(SmsService::maskPhone).orElse(null));

            dto.setAbsentPeriods(new ArrayList<>(entry.getValue()));
            dto.setDayWise(dayWiseAbsent.contains(sid));
            dto.setAlreadySent(alreadySentIds.contains(sid));
            out.add(dto);
        }

        // Sort: class label first, then admission number — reads naturally.
        out.sort(Comparator
                .comparing((AbsentTodayDto d) -> d.getClassLabel() == null ? "" : d.getClassLabel())
                .thenComparing(d -> d.getAdmissionNumber() == null ? "" : d.getAdmissionNumber()));
        return out;
    }

    /**
     * Send absence-alert SMS for the picked studentIds. Idempotency-guarded
     * via the audit log so a double-click can't re-send. Per-student dispatch
     * (not bulk) because each student's class label is different — that's
     * {@code var2} in the template.
     *
     * <p>Three counts are returned so the snackbar can be specific about
     * what happened: {@code queued} (sent now), {@code skippedAlreadySent}
     * (audit row from earlier today), {@code skippedNoPhone} (admin
     * needs to add a parent phone to that student).</p>
     */
    public SendAbsentTodayResponse sendAbsenceAlertsForToday(List<String> studentIds, String adminUserId) {
        if (studentIds == null || studentIds.isEmpty()) {
            throw new BusinessException("Pick at least one student.");
        }
        String tenantId = TenantContext.getTenantId();
        if (!smsConfig.isEnabled()) {
            throw new BusinessException("SMS is globally disabled. Contact platform admin.");
        }
        TenantSmsSettings settings = settingsRepo.findByTenantId(tenantId).orElse(null);
        if (settings == null || !settings.isEnabled()) {
            throw new BusinessException("SMS is not enabled for this school.");
        }
        if (!settings.isAbsenceAlertEnabled()) {
            throw new BusinessException(
                "Absence alerts are disabled for your school. Contact platform support to enable.");
        }

        LocalDate today = todayLocal();
        String friendlyDate = today.format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        // Idempotency: which of these studentIds were already sent today?
        java.time.Instant todayStart = today.atStartOfDay(ZoneId.of("Asia/Kolkata")).toInstant();
        Set<String> alreadySent = new HashSet<>();
        for (SmsAuditLog log : auditRepo.findExistingForEntities(
                tenantId, SmsTrigger.ABSENCE_ALERT, "AttendanceRecord",
                studentIds, todayStart)) {
            if (log != null && log.getRelatedEntityId() != null) {
                alreadySent.add(log.getRelatedEntityId());
            }
        }

        int queued = 0;
        int skippedAlreadySent = 0;
        int skippedNoPhone = 0;

        for (String sid : studentIds) {
            if (alreadySent.contains(sid)) { skippedAlreadySent++; continue; }
            Student stu = studentRepository.findByStudentIdAndDeletedAtIsNull(sid).orElse(null);
            if (stu == null) { skippedNoPhone++; continue; }

            List<String> extraPhones = new ArrayList<>();
            if (stu.getParentPhone() != null && !stu.getParentPhone().isBlank()) {
                extraPhones.add(stu.getParentPhone());
            }
            // Also try the linked Parent User records when available so
            // both data sources are covered. Phone-level dedupe inside
            // SmsService.resolveRecipients guarantees one SMS per phone.
            List<String> userIds = new ArrayList<>();
            if (stu.getParentIds() != null) userIds.addAll(stu.getParentIds());

            if (extraPhones.isEmpty() && userIds.isEmpty()) {
                skippedNoPhone++;
                continue;
            }

            String classLabel = resolveClassLabelFromStudent(stu);
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("student", buildStudentName(stu));
            vars.put("class", classLabel != null ? classLabel : "your school");
            vars.put("date", friendlyDate);

            // Dispatch async — returns immediately, audit row tracks status.
            dispatchAsync(SmsTrigger.ABSENCE_ALERT, userIds, extraPhones, vars,
                    adminUserId, "AttendanceRecord", sid);
            queued++;
        }

        auditService.log("SMS_ABSENT_TODAY", "AbsenceBatch", tenantId,
                "Manual today's-absent SMS by " + adminUserId
                        + " queued=" + queued
                        + " skippedAlreadySent=" + skippedAlreadySent
                        + " skippedNoPhone=" + skippedNoPhone);

        return new SendAbsentTodayResponse(queued, skippedAlreadySent, skippedNoPhone,
                java.time.Instant.now());
    }

    // ── Helpers for the manual absence flow ────────────────────

    /** Cache key for the per-(class,section) label cache used inside listAbsentToday. */
    private static String keyFor(String classId, String sectionId) {
        return (classId == null ? "" : classId) + "|" + (sectionId == null ? "" : sectionId);
    }

    private static String buildStudentName(Student stu) {
        if (stu == null) return "Student";
        String fn = stu.getFirstName();
        String ln = stu.getLastName();
        if (fn != null && !fn.isBlank()) {
            return ln != null && !ln.isBlank() ? (fn + " " + ln) : fn;
        }
        return "Student " + (stu.getAdmissionNumber() != null ? stu.getAdmissionNumber() : "");
    }

    /** Resolve "Class 10-A" style label from a Student's classId/sectionId.
     *  Returns null when neither name resolves — caller substitutes a
     *  safe fallback ("your school") so the SMS template never has a hole. */
    private String resolveClassLabelFromStudent(Student stu) {
        if (stu == null || stu.getClassId() == null) return null;
        try {
            SchoolClass sc = schoolClassRepository.findById(stu.getClassId()).orElse(null);
            if (sc == null) return null;
            String className = sc.getName() == null ? "" : sc.getName().trim();
            String sectionName = null;
            if (stu.getSectionId() != null && sc.getSections() != null) {
                for (SchoolClass.Section sec : sc.getSections()) {
                    if (sec != null && stu.getSectionId().equals(sec.getSectionId())) {
                        sectionName = sec.getName();
                        break;
                    }
                }
            }
            if (className.isEmpty() && (sectionName == null || sectionName.isBlank())) return null;
            if (sectionName == null || sectionName.isBlank()) return className;
            if (className.isEmpty()) return "Section " + sectionName;
            return className + "-" + sectionName;
        } catch (Exception e) {
            log.warn("resolveClassLabelFromStudent failed for studentId={}: {}",
                    stu.getStudentId(), e.getMessage());
            return null;
        }
    }

    /** Mask phones for safe display in the picker — preserves "+91" prefix
     *  and the last 4 digits, masks the middle with bullets. */
    private static String maskPhone(String normalized) {
        if (normalized == null) return null;
        int len = normalized.length();
        if (len <= 6) return normalized; // too short to mask sensibly
        String prefix = normalized.substring(0, Math.min(4, len));   // "+9178" or "+919"
        String suffix = normalized.substring(len - 4);
        int bullets = Math.max(1, len - prefix.length() - suffix.length());
        StringBuilder sb = new StringBuilder(prefix);
        for (int i = 0; i < bullets; i++) sb.append('•');
        sb.append(suffix);
        return sb.toString();
    }

    // ── Settings management (used by controllers) ──────────────

    /** Tenant view — returns existing settings or sensible defaults. */
    public TenantSmsSettings getSettingsOrDefault(String tenantId) {
        return settingsRepo.findByTenantId(tenantId)
                .orElseGet(() -> new TenantSmsSettings(tenantId));
    }

    /** Super Admin: patch settings. Creates the doc on first toggle.
     *  Only the fields present in the request are applied. */
    public TenantSmsSettings updateSettings(String tenantId,
                                            UpdateTenantSmsSettingsRequest req,
                                            String adminUserId) {
        TenantSmsSettings s = settingsRepo.findByTenantId(tenantId)
                .orElseGet(() -> new TenantSmsSettings(tenantId));

        if (req.getEnabled() != null)              s.setEnabled(req.getEnabled());
        if (req.getAbsenceAlertEnabled() != null)  s.setAbsenceAlertEnabled(req.getAbsenceAlertEnabled());
        if (req.getResultPublishEnabled() != null) s.setResultPublishEnabled(req.getResultPublishEnabled());
        if (req.getCustomNoticeEnabled() != null)  s.setCustomNoticeEnabled(req.getCustomNoticeEnabled());
        if (req.getMonthlyBudgetInr() != null)     s.setMonthlyBudgetInr(req.getMonthlyBudgetInr());
        if (req.getNotifyAdminOnFailure() != null) s.setNotifyAdminOnFailure(req.getNotifyAdminOnFailure());

        s.setUpdatedAt(Instant.now());
        s.setUpdatedBy(adminUserId);
        settingsRepo.save(s);

        auditService.log("SMS_SETTINGS_UPDATE", "TenantSmsSettings", tenantId,
                "SMS settings updated by super-admin " + adminUserId);
        return s;
    }

    /** Super Admin: hard-delete a tenant's SMS settings row.
     *
     *  Effectively the inverse of the initial "Enable for tenant" flow —
     *  removes the document so the tenant is back to the default "no SMS
     *  ever" state. The frontend uses this to off-board a school from SMS
     *  cleanly, including the case where a tenant was deleted but its
     *  orphaned SMS settings row is still hanging around.
     *
     *  Per-tenant SmsAuditLog rows are intentionally NOT touched — those
     *  live in the tenant's own DB and are part of the school's history.
     *  Resurfacing audit data after re-enabling later is desirable. */
    public long deleteSettings(String tenantId, String adminUserId) {
        long removed = settingsRepo.deleteByTenantId(tenantId);
        if (removed > 0) {
            auditService.log("SMS_SETTINGS_DELETE", "TenantSmsSettings", tenantId,
                    "SMS settings deleted by super-admin " + adminUserId);
        }
        return removed;
    }

    // ── Internals ──────────────────────────────────────────────

    /** Per-recipient: build the body, audit (PENDING), call provider,
     *  update audit row with the result, bump tenant cost counter. */
    private SmsAuditLog sendOne(String tenantId,
                                TenantSmsSettings settings,
                                SmsTrigger trigger,
                                String templateId,
                                RecipientInfo r,
                                Map<String, String> variables,
                                String triggeredBy,
                                String entityType,
                                String entityId) {

        // Audit row written FIRST as PENDING so we have a trace even if
        // the HTTP call hangs / process crashes mid-send.
        SmsAuditLog auditLog = new SmsAuditLog();
        auditLog.setTenantId(tenantId);
        auditLog.setTriggeredBy(triggeredBy);
        auditLog.setTrigger(trigger);
        auditLog.setTemplateId(templateId);
        auditLog.setRecipientPhone(r.phone());
        auditLog.setRecipientUserId(r.userId());
        auditLog.setRecipientRole(r.role());
        auditLog.setVariables(variables);
        auditLog.setBody(renderBodyForAudit(trigger, variables));
        auditLog.setStatus(SmsAuditLog.Status.PENDING);
        auditLog.setCreatedAt(Instant.now());
        auditLog.setCostInr(smsConfig.getCostPerSmsInr());
        auditLog.setRelatedEntityType(entityType);
        auditLog.setRelatedEntityId(entityId);
        auditRepo.save(auditLog);

        // Fire the actual MSG91 request.
        SmsProvider.SendResult result = smsProvider.send(new SmsProvider.SendArgs(
                r.phone(), templateId, smsConfig.getMsg91SenderId(), variables));

        if (result.success()) {
            auditLog.setStatus(SmsAuditLog.Status.SENT);
            auditLog.setSentAt(Instant.now());
            auditLog.setMsg91MessageId(result.messageId());
            // Bump tenant's monthly cost counter
            settings.setCostUsedThisMonth(
                    settings.getCostUsedThisMonth() + smsConfig.getCostPerSmsInr());
            settingsRepo.save(settings);
        } else {
            auditLog.setStatus(SmsAuditLog.Status.FAILED);
            auditLog.setErrorMessage(
                    "[" + result.errorCode() + "] " + result.errorMessage());
        }
        auditRepo.save(auditLog);
        return auditLog;
    }

    /** Skip path — write an audit row explaining why we didn't send.
     *  Lets the school admin see "SMS would have fired but was blocked
     *  because <reason>". */
    private void writeSkipped(String tenantId, SmsTrigger trigger,
                              Map<String, String> variables, String triggeredBy,
                              String entityType, String entityId, String reason) {
        SmsAuditLog row = new SmsAuditLog();
        row.setTenantId(tenantId);
        row.setTriggeredBy(triggeredBy);
        row.setTrigger(trigger);
        row.setStatus(SmsAuditLog.Status.SKIPPED);
        row.setErrorMessage(reason);
        row.setVariables(variables);
        row.setRelatedEntityType(entityType);
        row.setRelatedEntityId(entityId);
        row.setCreatedAt(Instant.now());
        auditRepo.save(row);
    }

    /** Merged userId + raw-phone resolution. Both sources flow through
     *  the same phone-level dedupe set so a parent who appears in both
     *  lists (e.g. has a User record AND is listed on Student.parentPhone)
     *  receives exactly one SMS.
     *
     *  Order: userIds first (preferred — gives us a recipientUserId for
     *  audit traceability), then extraPhones (raw — recipientUserId
     *  will be null and role marked PARENT_RAW). */
    private List<RecipientInfo> resolveRecipients(List<String> userIds, List<String> extraPhones) {
        Set<String> seenPhones = new HashSet<>();
        List<RecipientInfo> out = new ArrayList<>();

        // Path A: userIds → User.phone
        if (userIds != null) {
            for (String uid : userIds) {
                if (uid == null || uid.isBlank()) continue;
                Optional<User> userOpt = userRepository.findByUserIdAndDeletedAtIsNull(uid);
                if (userOpt.isEmpty()) continue;
                User u = userOpt.get();
                Optional<String> phone = phoneNumberService.normalize(u.getPhone());
                if (phone.isEmpty()) {
                    log.debug("Skipping user {} — invalid/missing phone on User record", uid);
                    continue;
                }
                if (!seenPhones.add(phone.get())) continue; // dedupe
                String role = u.getRole() == null ? "UNKNOWN" : u.getRole().name();
                out.add(new RecipientInfo(phone.get(), uid, role));
            }
        }

        // Path B: raw phones (e.g. Student.parentPhone) — no User lookup
        if (extraPhones != null) {
            for (String raw : extraPhones) {
                if (raw == null || raw.isBlank()) continue;
                Optional<String> phone = phoneNumberService.normalize(raw);
                if (phone.isEmpty()) {
                    log.debug("Skipping raw phone '{}' — failed normalization", raw);
                    continue;
                }
                if (!seenPhones.add(phone.get())) continue; // dedupe across paths
                // recipientUserId stays null — these aren't linked to a User.
                // Role "PARENT_RAW" distinguishes from user-resolved sends in audit.
                out.add(new RecipientInfo(phone.get(), null, "PARENT_RAW"));
            }
        }
        return out;
    }

    /** Pick the template id based on which trigger fired. */
    private String templateIdFor(SmsTrigger trigger) {
        return switch (trigger) {
            case ABSENCE_ALERT   -> smsConfig.getTplAbsenceAlert();
            case RESULT_COMBINED -> smsConfig.getTplResultCombined();
            case RESULT_SINGLE   -> smsConfig.getTplResultSingle();
            case CUSTOM_NOTICE   -> smsConfig.getTplCustomNotice();
        };
    }

    /** Render the body for audit logging — approximate the real SMS the
     *  parent will see. We can't ask MSG91 for the rendered body, so we
     *  reconstruct it from the registered template + variable values.
     *  Used only for the audit UI, never for actual delivery. */
    private String renderBodyForAudit(SmsTrigger trigger, Map<String, String> vars) {
        if (vars == null || vars.isEmpty()) return "(no variables)";
        return switch (trigger) {
            case ABSENCE_ALERT -> String.format(
                    "Dear Parent, %s of %s was marked absent on %s. " +
                    "Please contact the school for details.- Vincent Thrives Pvt Ltd",
                    // Variable names match the MSG91 template
                    // (##student##, ##class##, ##date##). Mirrored here so
                    // the audit log preview reads the same as the actual
                    // SMS the parent receives.
                    vars.getOrDefault("student", "—"),
                    vars.getOrDefault("class", "—"),
                    vars.getOrDefault("date", "—"));
            // Phase 2+3 templates render after their bodies are finalised.
            default -> "(rendered at send time — see MSG91 logs)";
        };
    }

    /** Roll the monthly cost counter to zero when a new calendar month
     *  begins. Avoids needing a cron — counter check happens lazily
     *  every time SMS is dispatched. */
    private void resetMonthlyCounterIfNeeded(TenantSmsSettings settings) {
        String currentMonth = YearMonth.now(ZoneId.of("Asia/Kolkata")).toString();
        if (!currentMonth.equals(settings.getCostMonth())) {
            log.info("Resetting SMS monthly budget for tenant {} ({} → {})",
                    settings.getTenantId(), settings.getCostMonth(), currentMonth);
            settings.setCostMonth(currentMonth);
            settings.setCostUsedThisMonth(0.0);
            settingsRepo.save(settings);
        }
    }

    /** Tuple carried through the per-recipient send loop. */
    private record RecipientInfo(String phone, String userId, String role) {}
}
