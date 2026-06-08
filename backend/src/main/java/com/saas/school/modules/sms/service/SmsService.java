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
import com.saas.school.modules.sms.dto.SendHolidayNoticeRequest;
import com.saas.school.modules.sms.dto.SendHolidayNoticeResponse;
import com.saas.school.modules.sms.dto.SmsAudience;
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

            // ── Template + sender resolution. Pure tenant lookup, no
            //     fallback. If Super Admin hasn't pasted a template for
            //     this trigger on the SMS Control page's expanded row,
            //     the dispatch path writes a SKIPPED audit row.
            ResolvedTemplate rt = resolveTemplate(settings, trigger);
            if (rt == null) {
                log.warn("No DLT template configured for tenant {} / trigger {} — skipping", tenantId, trigger);
                writeSkipped(tenantId, trigger, variables, triggeredBy, entityType, entityId,
                        "DLT template not configured for trigger " + trigger);
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
                sendOne(tenantId, settings, trigger, rt, r, variables,
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
        // Test uses the school's Absence Alert template — same resolver
        // as a real absence dispatch. If Super Admin hasn't pasted one
        // on the SMS Control page, this throws so the admin sees the gap
        // immediately instead of a silent no-op.
        ResolvedTemplate rt = resolveTemplate(settings, SmsTrigger.ABSENCE_ALERT);
        if (rt == null) {
            throw new BusinessException(
                "Absence Alert template not configured. Ask the platform admin to set it up under SMS Control.");
        }

        // Variables stamped under both semantic AND positional keys —
        // DLT templates registered with {#var#} placeholders match by
        // position (var1/var2/var3) while the legacy MSG91 absence
        // template uses named ones (student/class/date). Sending both
        // covers either registration style.
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("student", "Test Student");
        vars.put("class", "Test Class");
        vars.put("date", "Test Date");
        vars.put("var1", "Test Student");
        vars.put("var2", "Test Class");
        vars.put("var3", "Test Date");

        RecipientInfo recipient = new RecipientInfo(phone.get(), requestingUserId, "ADMIN_TEST");
        return sendOne(tenantId, settings, SmsTrigger.ABSENCE_ALERT, rt, recipient, vars,
                requestingUserId, "SmsTest", requestingUserId);
    }

    /**
     * Broadcast a custom SMS to a chosen audience inside the current tenant.
     *
     * <p>This is the school-admin-facing "send a custom message" flow.
     * Distinct from {@link #dispatchAsync} in that the trigger gating
     * happens here once (rather than per-recipient on a system rule fire),
     * and the recipient set is resolved up-front from the requested
     * {@link SmsAudience}:</p>
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
        List<SmsAudience> audiences = req.getAudiences();
        if (audiences == null || audiences.isEmpty()) {
            throw new BusinessException("Pick at least one audience.");
        }
        if (audiences.contains(SmsAudience.CLASS)
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

        AudienceTargets targets = resolveAudiences(audiences, req.getClassId());
        if (targets.userIds().isEmpty() && targets.extraPhones().isEmpty()) {
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

        // 7-arg dispatch carries the raw parent phones in addition to
        // userIds so parents whose number lives only on
        // Student.parentPhone (no linked User record) still receive
        // the broadcast. Phone dedupe in resolveRecipients trims any
        // double-coverage to one SMS.
        dispatchAsync(SmsTrigger.CUSTOM_NOTICE, targets.userIds(), targets.extraPhones(),
                vars, adminUserId, "CustomNotice", "broadcast-" + audienceLabel);

        int recipientCount = targets.userIds().size() + targets.extraPhones().size();

        auditService.log("SMS_CUSTOM_NOTICE", "CustomNotice", tenantId,
                "Broadcast queued by " + adminUserId + " audiences=" + audienceLabel
                        + (req.getClassId() != null ? " classId=" + req.getClassId() : "")
                        + " recipients=" + recipientCount);

        return new SendCustomNoticeResponse(audienceNames, recipientCount, Instant.now());
    }

    /**
     * Send a holiday / closure notice to the chosen audience. Variables
     * are stamped as var1/var2/var3 (and semantic aliases) so they slot
     * into the school's HOLIDAY_NOTICE DLT template's {@code {#var#}}
     * placeholders in order.
     *
     * <p>Tenant must:</p>
     * <ol>
     *   <li>Have SMS enabled (master toggle)</li>
     *   <li>Have the Holiday trigger checkbox ON in the Tenant Settings table</li>
     *   <li>Have a HOLIDAY_NOTICE template pasted on the SMS Control row's
     *       expanded panel (templateId + senderId)</li>
     * </ol>
     *
     * <p>Failing any of these throws a clear synchronous error so the
     * school admin sees the gap before parents notice.</p>
     */
    public SendHolidayNoticeResponse sendHolidayNotice(SendHolidayNoticeRequest req, String adminUserId) {
        if (req == null) throw new BusinessException("Holiday notice payload is required.");
        if (req.getClosureDate() == null || req.getClosureDate().isBlank())
            throw new BusinessException("closureDate is required.");
        if (req.getReason() == null || req.getReason().isBlank())
            throw new BusinessException("reason is required.");
        if (req.getReopenDate() == null || req.getReopenDate().isBlank())
            throw new BusinessException("reopenDate is required.");

        List<SmsAudience> audiences = req.getAudiences();
        if (audiences == null || audiences.isEmpty())
            throw new BusinessException("Pick at least one audience.");
        if (audiences.contains(SmsAudience.CLASS)
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
        if (!settings.isTriggerEnabled(SmsTrigger.HOLIDAY_NOTICE)) {
            throw new BusinessException(
                "Holiday SMS is disabled for your school. Ask the platform admin to enable it under SMS Control.");
        }
        TenantSmsSettings.SmsTemplate tpl = settings.templateFor(SmsTrigger.HOLIDAY_NOTICE);
        if (tpl == null || !tpl.isResolvable()) {
            throw new BusinessException(
                "Holiday notice template not configured for your school. Ask the platform admin to set it up.");
        }

        AudienceTargets targets = resolveAudiences(audiences, req.getClassId());
        if (targets.userIds().isEmpty() && targets.extraPhones().isEmpty()) {
            throw new BusinessException("No recipients matched the chosen audience(s).");
        }

        // Both positional (var1/var2/var3) AND semantic (closureDate /
        // reason / reopenDate) keys so the DLT registration style on
        // the school's side renders correctly regardless of whether
        // their template was approved with positional or named placeholders.
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("var1", req.getClosureDate().trim());
        vars.put("var2", req.getReason().trim());
        vars.put("var3", req.getReopenDate().trim());
        vars.put("closureDate", req.getClosureDate().trim());
        vars.put("reason",      req.getReason().trim());
        vars.put("reopenDate",  req.getReopenDate().trim());

        List<String> audienceNames = audiences.stream().map(Enum::name).toList();
        String audienceLabel = String.join(",", audienceNames);

        // 7-arg dispatch carries the raw parent phones in addition to
        // userIds. Phone-level dedupe inside resolveRecipients
        // guarantees one SMS per phone even when a parent appears in
        // both lists (linked Parent User AND Student.parentPhone).
        dispatchAsync(SmsTrigger.HOLIDAY_NOTICE, targets.userIds(), targets.extraPhones(),
                vars, adminUserId, "HolidayNotice", "broadcast-" + audienceLabel);

        // Rough pre-dedupe recipient count for the snackbar — actual
        // phone count after normalisation might be slightly lower.
        int recipientCount = targets.userIds().size() + targets.extraPhones().size();

        auditService.log("SMS_HOLIDAY_NOTICE", "HolidayNotice", tenantId,
                "Holiday broadcast queued by " + adminUserId + " audiences=" + audienceLabel
                        + (req.getClassId() != null ? " classId=" + req.getClassId() : "")
                        + " closure=" + req.getClosureDate()
                        + " reopen=" + req.getReopenDate()
                        + " recipients=" + recipientCount);

        return new SendHolidayNoticeResponse(audienceNames, recipientCount, Instant.now());
    }

    /**
     * Audiences → unioned, deduped recipient bundle: userIds + raw
     * extraPhones.
     *
     * <p>Why TWO collections: students store a parent's number in two
     * places — sometimes as a linked Parent User document (resolved
     * via {@code Student.parentIds} → {@code User.phone}), and almost
     * always also as a free-text field {@code Student.parentPhone}
     * (set at admission, no User record auto-created). For absence
     * alerts we already merged both via the {@code extraPhones}
     * overload of {@link #dispatchAsync}; broadcasts (custom-notice,
     * holiday-notice) used to skip the free-text path and silently
     * miss any parent who only has a {@code parentPhone}. Now they
     * pull both. Phone-level dedupe in {@link #resolveRecipients}
     * still guarantees one SMS per phone even when a parent appears
     * in both sources.</p>
     *
     * @param audiences the audiences picked in the UI
     * @param classId   required only when the list contains {@code CLASS}
     */
    private AudienceTargets resolveAudiences(List<SmsAudience> audiences, String classId) {
        // LinkedHashSet → preserve audience ordering, kill obvious duplicates.
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        LinkedHashSet<String> phones = new LinkedHashSet<>();
        for (SmsAudience a : audiences) {
            AudienceTargets t = resolveOneAudience(a, classId);
            ids.addAll(t.userIds());
            phones.addAll(t.extraPhones());
        }
        return new AudienceTargets(new ArrayList<>(ids), new ArrayList<>(phones));
    }

    /** Resolves a single audience to its userIds + raw extra phones. */
    private AudienceTargets resolveOneAudience(SmsAudience audience, String classId) {
        return switch (audience) {
            case ALL -> {
                List<String> userIds = collectUserIds(userRepository.findAllByDeletedAtIsNull());
                // "Everyone" should also reach parents who only exist as
                // Student.parentPhone (no User record). Pull those too.
                List<String> phones  = collectStudentParentPhones(studentRepository.findByDeletedAtIsNull());
                yield new AudienceTargets(userIds, phones);
            }
            case ALL_STUDENTS -> {
                List<Student> students = studentRepository.findByDeletedAtIsNull();
                yield new AudienceTargets(
                        collectStudentParentUserIds(students),
                        collectStudentParentPhones(students));
            }
            case ALL_EMPLOYEES -> {
                List<String> ids = new ArrayList<>();
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.TEACHER)));
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.PRINCIPAL)));
                ids.addAll(collectUserIds(userRepository.findAllByRoleAndDeletedAtIsNull(UserRole.SCHOOL_ADMIN)));
                // Teachers/principals/admins always have User records — no
                // raw-phone path needed.
                yield new AudienceTargets(ids, List.of());
            }
            case CLASS -> {
                List<Student> students = studentRepository.findAllByClassIdAndDeletedAtIsNull(classId);
                yield new AudienceTargets(
                        collectStudentParentUserIds(students),
                        collectStudentParentPhones(students));
            }
        };
    }

    /** Tuple returned by {@link #resolveAudiences}. {@code userIds} go
     *  through User-record lookup; {@code extraPhones} are raw strings
     *  fed straight to {@link #resolveRecipients} which normalises and
     *  dedupes them against the user-resolved phones. */
    record AudienceTargets(List<String> userIds, List<String> extraPhones) {}

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

    /** Raw parent phones from {@code Student.parentPhone}. Almost every
     *  student has this set at admission even when no Parent User is
     *  linked, so this is the primary path for reaching parents in
     *  broadcasts. Normalisation + dedupe happens later in
     *  {@link #resolveRecipients}. */
    private List<String> collectStudentParentPhones(List<Student> students) {
        if (students == null) return List.of();
        List<String> out = new ArrayList<>();
        for (Student s : students) {
            if (s == null) continue;
            String p = s.getParentPhone();
            if (p != null && !p.isBlank()) out.add(p.trim());
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
            String studentName = buildStudentName(stu);
            String classText   = classLabel != null ? classLabel : "your school";
            Map<String, String> vars = new LinkedHashMap<>();
            vars.put("student", studentName);
            vars.put("class", classText);
            vars.put("date", friendlyDate);
            // Positional aliases — DLT templates registered with {#var#}
            // placeholders match var1/var2/var3 by position. Sending
            // both shapes lets either registration style work.
            vars.put("var1", studentName);
            vars.put("var2", classText);
            vars.put("var3", friendlyDate);

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
        if (req.getHolidayNoticeEnabled() != null) s.setHolidayNoticeEnabled(req.getHolidayNoticeEnabled());
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
                                ResolvedTemplate rt,
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
        auditLog.setTemplateId(rt.templateId());
        auditLog.setSenderId(rt.senderId());
        auditLog.setRecipientPhone(r.phone());
        auditLog.setRecipientUserId(r.userId());
        auditLog.setRecipientRole(r.role());
        auditLog.setVariables(variables);
        auditLog.setBody(renderBodyForAudit(settings, trigger, variables));
        auditLog.setStatus(SmsAuditLog.Status.PENDING);
        auditLog.setCreatedAt(Instant.now());
        auditLog.setCostInr(smsConfig.getCostPerSmsInr());
        auditLog.setRelatedEntityType(entityType);
        auditLog.setRelatedEntityId(entityId);
        auditRepo.save(auditLog);

        // Fire the actual MSG91 request.
        // Use the resolved tenant sender header (e.g. STANNE), NOT the
        // global smsConfig default. Every send goes out under the
        // school's own DLT-registered header that Super Admin pasted.
        SmsProvider.SendResult result = smsProvider.send(new SmsProvider.SendArgs(
                r.phone(), rt.templateId(), rt.senderId(), variables));

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

    /**
     * Resolve (templateId, senderId) for the given (tenant, trigger).
     *
     * <p>Pure tenant lookup — there is no platform fallback. Every
     * trigger's template is set by Super Admin on the SMS Control
     * page's expanded row. If they haven't set one, return null and
     * the caller writes a SKIPPED audit row.</p>
     *
     * <p>VTPLS, STANNE, SPRING — these are all just sender header
     * strings the operator might paste. None of them are special.</p>
     */
    ResolvedTemplate resolveTemplate(TenantSmsSettings settings, SmsTrigger trigger) {
        if (settings == null) return null;
        TenantSmsSettings.SmsTemplate t = settings.templateFor(trigger);
        if (t == null || !t.isResolvable()) return null;
        return new ResolvedTemplate(t.getTemplateId(), t.getSenderId());
    }

    /** Resolved (templateId, senderId) tuple. */
    public record ResolvedTemplate(String templateId, String senderId) {}

    // ── Per-tenant template config CRUD ────────────────────────────

    /**
     * Read a tenant's per-trigger DLT template overrides. Returns an
     * empty map (not null) when none configured. Called by both the
     * Super Admin's accordion panel (full edit) and the school admin's
     * read-only "available templates" badge row.
     */
    public Map<String, TenantSmsSettings.SmsTemplate> getTenantTemplates(String tenantId) {
        TenantSmsSettings s = settingsRepo.findByTenantId(tenantId).orElse(null);
        if (s == null) return Map.of();
        return s.getTemplates();
    }

    /**
     * Upsert the per-trigger DLT template overrides for a tenant.
     * Creates the {@link TenantSmsSettings} document on first call.
     * Only the templates map is touched — other settings (enabled
     * flags, budget) are preserved.
     *
     * <p>Entries where templateId, senderId AND body are all blank
     * are dropped (= "operator cleared this trigger's template").
     * Unknown trigger keys silently ignored so a stale frontend
     * can't pollute the document.</p>
     */
    public Map<String, TenantSmsSettings.SmsTemplate> upsertTenantTemplates(
            String tenantId,
            Map<String, TenantSmsSettings.SmsTemplate> templates,
            String adminUserId) {
        TenantSmsSettings s = settingsRepo.findByTenantId(tenantId).orElse(null);
        if (s == null) s = new TenantSmsSettings(tenantId);

        Map<String, TenantSmsSettings.SmsTemplate> out = new HashMap<>();
        if (templates != null) {
            for (Map.Entry<String, TenantSmsSettings.SmsTemplate> e : templates.entrySet()) {
                String key = e.getKey();
                TenantSmsSettings.SmsTemplate v = e.getValue();
                if (key == null || key.isBlank() || v == null) continue;
                try {
                    SmsTrigger.valueOf(key);
                } catch (IllegalArgumentException ex) {
                    log.warn("Ignoring unknown trigger key '{}' in template upsert for tenant {}", key, tenantId);
                    continue;
                }
                boolean empty = (v.getTemplateId() == null || v.getTemplateId().isBlank())
                        && (v.getSenderId() == null || v.getSenderId().isBlank())
                        && (v.getBody() == null || v.getBody().isBlank());
                if (empty) continue;
                out.put(key, v);
            }
        }
        s.setTemplates(out);
        s.setUpdatedAt(Instant.now());
        s.setUpdatedBy(adminUserId);
        settingsRepo.save(s);
        auditService.log("SMS_TEMPLATES_UPSERT", "TenantSmsSettings", tenantId,
                "Templates updated by " + adminUserId + " count=" + out.size()
                        + " triggers=" + String.join(",", out.keySet()));
        return out;
    }

    /** Render the body for audit logging — approximate the real SMS
     *  the parent will see. MSG91 doesn't return the rendered body,
     *  so we reconstruct it from the tenant's stored template body
     *  + the actual variable values stamped on the dispatch. The
     *  preview only — never sent to MSG91. */
    private String renderBodyForAudit(TenantSmsSettings settings, SmsTrigger trigger,
                                      Map<String, String> vars) {
        if (vars == null || vars.isEmpty()) return "(no variables)";
        TenantSmsSettings.SmsTemplate t = settings == null ? null : settings.templateFor(trigger);
        if (t != null && t.getBody() != null && !t.getBody().isBlank()) {
            return substituteVarPlaceholders(t.getBody(), vars);
        }
        return "(rendered at send time — see MSG91 logs)";
    }

    /** Replace each {@code {#var#}} placeholder in {@code body} with
     *  the value of {@code var1, var2, var3, ...} (positional). Missing
     *  slots fall back to an em dash. Matches how DLT templates render
     *  on the operator's side. */
    private String substituteVarPlaceholders(String body, Map<String, String> vars) {
        StringBuilder out = new StringBuilder();
        int i = 0, slot = 1;
        while (i < body.length()) {
            int open = body.indexOf("{#var#}", i);
            if (open < 0) { out.append(body, i, body.length()); break; }
            out.append(body, i, open);
            String value = vars.get("var" + slot);
            out.append(value == null || value.isBlank() ? "—" : value);
            slot++;
            i = open + "{#var#}".length();
        }
        return out.toString();
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
