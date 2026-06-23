package com.saas.school.modules.sms.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.sms.dto.AbsentTodayDto;
import com.saas.school.modules.sms.dto.SendAbsentTodayRequest;
import com.saas.school.modules.sms.dto.SendAbsentTodayResponse;
import com.saas.school.modules.sms.dto.SendCustomNoticeRequest;
import com.saas.school.modules.sms.dto.SendCustomNoticeResponse;
import com.saas.school.modules.sms.dto.SendEventNoticeRequest;
import com.saas.school.modules.sms.dto.SendEventNoticeResponse;
import com.saas.school.modules.sms.dto.ConductedExamTypeDto;
import com.saas.school.modules.sms.dto.SendHolidayNoticeRequest;
import com.saas.school.modules.sms.dto.SendHolidayNoticeResponse;
import com.saas.school.modules.sms.dto.SendResultNoticeRequest;
import com.saas.school.modules.sms.dto.SendResultNoticeResponse;
import com.saas.school.modules.sms.dto.SendTestSmsRequest;
import com.saas.school.modules.sms.dto.SmsAuditLogDto;
import com.saas.school.modules.sms.dto.TenantSmsSettingsDto;
import com.saas.school.modules.sms.model.SmsAuditLog;
import com.saas.school.modules.sms.model.TenantSmsSettings;
import com.saas.school.modules.sms.model.SmsTrigger;
import com.saas.school.modules.sms.repository.SmsAuditLogRepository;
import com.saas.school.modules.sms.service.SmsService;
import com.saas.school.modules.notification.service.ResultPublicationService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Tenant-facing SMS endpoints.
 *
 * Every endpoint here is READ-ONLY (or write-but-doesn't-mutate-config).
 * Toggling SMS on/off and changing budgets is the SUPER_ADMIN's job —
 * see {@link SuperAdminSmsController}. This split enforces the
 * platform-vs-tenant separation requested in the architecture.
 */
@Tag(name = "SMS — Tenant")
@RestController
@RequestMapping("/api/v1/sms")
public class SmsController {

    @Autowired private SmsService smsService;
    @Autowired private SmsAuditLogRepository auditRepo;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private com.saas.school.modules.student.repository.StudentRepository studentRepository;
    @Autowired private com.saas.school.modules.classes.repository.SchoolClassRepository schoolClassRepository;
    /** Reaches into the notification module to fan result SMS out across
     *  multiple sections. ResultPublicationService owns the exam/mark
     *  load-and-summarise pipeline; the controller stays thin. */
    @Autowired private ResultPublicationService resultPublicationService;

    /** Read-only view of THIS tenant's SMS settings. Returns sensible
     *  defaults (everything off) if no settings doc exists yet — avoids
     *  needing a separate "configured?" check on the frontend. */
    @GetMapping("/settings")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<TenantSmsSettingsDto>> mySettings() {
        String tenantId = TenantContext.getTenantId();
        var settings = smsService.getSettingsOrDefault(tenantId);
        return ResponseEntity.ok(ApiResponse.success(TenantSmsSettingsDto.from(settings)));
    }

    /** Paginated audit log for THIS tenant. Phone numbers are partially
     *  masked in the response — admins see enough to recognise
     *  recipients without exposing full phones in screenshots.
     *
     *  <p>All filters are optional and stack as ANDs:
     *  <ul>
     *    <li>{@code trigger} — exact enum match (ABSENCE_ALERT, HOLIDAY_NOTICE, …)</li>
     *    <li>{@code status} — CSV of statuses; pass "SENT,DELIVERED" for the
     *        "Sent" bucket, "FAILED,SKIPPED" for the "Not Sent" bucket</li>
     *    <li>{@code dateFrom} / {@code dateTo} — ISO instants, inclusive on
     *        the from edge, exclusive on the to edge to play nicely with
     *        day-boundary date pickers</li>
     *  </ul>
     */
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<SmsAuditLogDto>>> myAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String trigger,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String classLabel) {
        String tenantId = TenantContext.getTenantId();

        Criteria criteria = Criteria.where("tenantId").is(tenantId);

        // Class filter — narrows the result set to AttendanceRecord rows
        // whose student is in the matching (class, section). Done BEFORE
        // pagination so the totalElements + page slice line up; without
        // this the chip filter was a page-local cosmetic and pagination
        // broke for 30-section schools.
        if (classLabel != null && !classLabel.isBlank()) {
            List<String> studentIdsInClass = resolveStudentIdsByClassLabel(classLabel);
            if (studentIdsInClass.isEmpty()) {
                // No matches → return an empty page rather than skipping the
                // criteria (which would expose unrelated rows).
                return ResponseEntity.ok(ApiResponse.success(
                        PageResponse.of(java.util.List.of(), 0L, page, size)));
            }
            criteria.and("relatedEntityType").is("AttendanceRecord");
            criteria.and("relatedEntityId").in(studentIdsInClass);
        }

        if (trigger != null && !trigger.isBlank()) {
            try {
                criteria.and("trigger").is(SmsTrigger.valueOf(trigger.trim()));
            } catch (IllegalArgumentException ignored) {
                // Unknown trigger → no matches. Don't 400 — the UI may pass
                // stale values from a cached dropdown; an empty page is gentler.
                criteria.and("trigger").is("__unknown__");
            }
        }
        if (status != null && !status.isBlank()) {
            List<SmsAuditLog.Status> statuses = new java.util.ArrayList<>();
            for (String s : status.split(",")) {
                String trimmed = s.trim();
                if (trimmed.isEmpty()) continue;
                try { statuses.add(SmsAuditLog.Status.valueOf(trimmed)); }
                catch (IllegalArgumentException ignored) { /* drop bad token */ }
            }
            if (!statuses.isEmpty()) criteria.and("status").in(statuses);
        }
        if ((dateFrom != null && !dateFrom.isBlank())
                || (dateTo != null && !dateTo.isBlank())) {
            Criteria dateCriteria = Criteria.where("createdAt");
            if (dateFrom != null && !dateFrom.isBlank()) {
                dateCriteria = dateCriteria.gte(parseInstant(dateFrom));
            }
            if (dateTo != null && !dateTo.isBlank()) {
                dateCriteria = dateCriteria.lt(parseInstant(dateTo));
            }
            criteria.andOperator(dateCriteria);
        }

        Query query = new Query(criteria).with(Sort.by("createdAt").descending());
        long total = mongoTemplate.count(query, SmsAuditLog.class);
        query.skip((long) page * size).limit(size);
        List<SmsAuditLog> result = mongoTemplate.find(query, SmsAuditLog.class);

        // Resolve student names for any AttendanceRecord rows on this page
        // so the audit table can show "Pallavi Kamath" alongside the parent
        // phone instead of just an opaque +91••••• number. One batched
        // findByStudentIdInAndDeletedAtIsNull keeps it O(1) per row.
        java.util.Set<String> studentIds = new java.util.HashSet<>();
        for (SmsAuditLog l : result) {
            if ("AttendanceRecord".equals(l.getRelatedEntityType())
                    && l.getRelatedEntityId() != null) {
                studentIds.add(l.getRelatedEntityId());
            }
        }
        java.util.Map<String, String> studentNamesById = new java.util.HashMap<>();
        java.util.Map<String, String> studentClassesById = new java.util.HashMap<>();
        if (!studentIds.isEmpty()) {
            var students = studentRepository.findByStudentIdInAndDeletedAtIsNull(
                    new java.util.ArrayList<>(studentIds));
            // Pre-fetch every SchoolClass referenced by the page in one
            // query, then resolve "class-name + section-name" per student
            // against an in-memory map. Avoids N round-trips when the
            // page has students from many classes.
            java.util.Set<String> classIds = new java.util.HashSet<>();
            if (students != null) {
                for (var s : students) {
                    if (s.getClassId() != null) classIds.add(s.getClassId());
                }
            }
            java.util.Map<String, com.saas.school.modules.classes.model.SchoolClass> classById = new java.util.HashMap<>();
            if (!classIds.isEmpty()) {
                for (var c : schoolClassRepository.findAllById(classIds)) {
                    classById.put(c.getClassId(), c);
                }
            }
            if (students != null) {
                for (var s : students) {
                    String first = s.getFirstName() == null ? "" : s.getFirstName();
                    String last = s.getLastName() == null ? "" : s.getLastName();
                    String full = (first + " " + last).trim();
                    if (full.isEmpty()) full = s.getStudentId();
                    studentNamesById.put(s.getStudentId(), full);

                    var sc = classById.get(s.getClassId());
                    if (sc != null) {
                        String className = sc.getName() == null ? "" : sc.getName().trim();
                        String sectionName = null;
                        if (s.getSectionId() != null && sc.getSections() != null) {
                            for (var sec : sc.getSections()) {
                                if (sec != null && s.getSectionId().equals(sec.getSectionId())) {
                                    sectionName = sec.getName();
                                    break;
                                }
                            }
                        }
                        String label = sectionName != null && !sectionName.isBlank()
                                ? (className + "-" + sectionName)
                                : className;
                        if (!label.isBlank()) studentClassesById.put(s.getStudentId(), label);
                    }
                }
            }
        }

        List<SmsAuditLogDto> dtos = result.stream()
                .map(l -> SmsAuditLogDto.from(l, true, studentNamesById, studentClassesById))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(
                PageResponse.of(dtos, total, page, size)));
    }

    /**
     * Distinct class labels (e.g. "10-A", "10-B") across this tenant's
     * absence-alert audit rows. Drives the chip filter on the audit log
     * UI — without it the chip options would have to be guessed from
     * the visible page, which broke for paginated views.
     *
     * <p>Filters (trigger / status / date range) are NOT applied here;
     * the chip should always offer every class the school has sent
     * absence alerts for, regardless of what the date/status pickers
     * narrow to. Cheap query — fetches AttendanceRecord-linked audit
     * rows for the tenant, resolves their students, walks classes.</p>
     */
    @GetMapping("/audit-logs/class-labels")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<String>>> auditClassLabels() {
        String tenantId = TenantContext.getTenantId();
        Criteria criteria = Criteria.where("tenantId").is(tenantId)
                .and("relatedEntityType").is("AttendanceRecord");
        Query query = new Query(criteria);
        List<SmsAuditLog> rows = mongoTemplate.find(query, SmsAuditLog.class);
        if (rows.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(java.util.List.of()));
        }
        java.util.Set<String> studentIds = new java.util.HashSet<>();
        for (SmsAuditLog r : rows) {
            if (r.getRelatedEntityId() != null) studentIds.add(r.getRelatedEntityId());
        }
        java.util.Set<String> labels = new java.util.TreeSet<>(
                (a, b) -> a.compareTo(b));
        if (!studentIds.isEmpty()) {
            var students = studentRepository.findByStudentIdInAndDeletedAtIsNull(
                    new java.util.ArrayList<>(studentIds));
            java.util.Set<String> classIds = new java.util.HashSet<>();
            for (var s : students) if (s.getClassId() != null) classIds.add(s.getClassId());
            java.util.Map<String, com.saas.school.modules.classes.model.SchoolClass> classById = new java.util.HashMap<>();
            if (!classIds.isEmpty()) {
                for (var c : schoolClassRepository.findAllById(classIds)) {
                    classById.put(c.getClassId(), c);
                }
            }
            for (var s : students) {
                var sc = classById.get(s.getClassId());
                if (sc == null) continue;
                String className = sc.getName() == null ? "" : sc.getName().trim();
                String sectionName = null;
                if (s.getSectionId() != null && sc.getSections() != null) {
                    for (var sec : sc.getSections()) {
                        if (sec != null && s.getSectionId().equals(sec.getSectionId())) {
                            sectionName = sec.getName();
                            break;
                        }
                    }
                }
                String label = sectionName != null && !sectionName.isBlank()
                        ? (className + "-" + sectionName)
                        : className;
                if (!label.isBlank()) labels.add(label);
            }
        }
        // Numeric-aware sort so "10-A" follows "2-A" instead of preceding "3-A".
        java.util.List<String> sorted = new java.util.ArrayList<>(labels);
        sorted.sort((a, b) -> {
            // Comparator that treats embedded integers naturally.
            return naturalCompare(a, b);
        });
        return ResponseEntity.ok(ApiResponse.success(sorted));
    }

    /** Resolve which student ids live in the (class, section) identified
     *  by a "ClassName-SectionName" label. Multiple SchoolClass docs may
     *  share a name across academic years; we union the matches because
     *  the audit log spans years anyway. */
    private List<String> resolveStudentIdsByClassLabel(String classLabel) {
        int dash = classLabel.lastIndexOf('-');
        String className = dash > 0 ? classLabel.substring(0, dash) : classLabel;
        String sectionName = dash > 0 ? classLabel.substring(dash + 1) : null;
        // Find all SchoolClass docs whose name matches className (any AY).
        // Mongo-side filter would require a custom query; in practice each
        // tenant has under 20 class docs total, so an in-memory scan is fine.
        var allClasses = schoolClassRepository.findAll();
        List<String> studentIds = new java.util.ArrayList<>();
        for (var sc : allClasses) {
            if (sc.getName() == null || !sc.getName().trim().equalsIgnoreCase(className)) continue;
            if (sectionName == null) {
                // No section in label → every section of this class counts.
                if (sc.getSections() != null) {
                    for (var sec : sc.getSections()) {
                        studentIds.addAll(
                                studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(
                                        sc.getClassId(), sec.getSectionId())
                                        .stream().map(s -> s.getStudentId()).toList());
                    }
                }
            } else {
                // Find the matching section by name.
                if (sc.getSections() != null) {
                    for (var sec : sc.getSections()) {
                        if (sec != null && sec.getName() != null
                                && sec.getName().trim().equalsIgnoreCase(sectionName)) {
                            studentIds.addAll(
                                    studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(
                                            sc.getClassId(), sec.getSectionId())
                                            .stream().map(s -> s.getStudentId()).toList());
                        }
                    }
                }
            }
        }
        return studentIds;
    }

    /** Numeric-aware string compare: "2-A" < "10-A" by parsing leading
     *  digits when present. Falls back to standard compare for non-numeric
     *  prefixes (LKG, UKG). */
    private static int naturalCompare(String a, String b) {
        int aDash = a.indexOf('-');
        int bDash = b.indexOf('-');
        String aPrefix = aDash >= 0 ? a.substring(0, aDash) : a;
        String bPrefix = bDash >= 0 ? b.substring(0, bDash) : b;
        try {
            int aNum = Integer.parseInt(aPrefix);
            int bNum = Integer.parseInt(bPrefix);
            if (aNum != bNum) return Integer.compare(aNum, bNum);
            return a.compareTo(b);
        } catch (NumberFormatException e) {
            return a.compareTo(b);
        }
    }

    /** Parse an ISO-8601 instant, falling back to "yyyy-MM-dd" at UTC midnight
     *  so the date pickers can send either format without a 400. */
    private java.time.Instant parseInstant(String raw) {
        String trimmed = raw.trim();
        try {
            return java.time.Instant.parse(trimmed);
        } catch (Exception ignored) {
            // Try date-only ISO → midnight UTC.
            return java.time.LocalDate.parse(trimmed)
                    .atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
        }
    }

    /** Send a single test SMS to the admin's own number. Lets them
     *  verify the SMS pipeline before going live with real parents.
     *
     *  Tenant must have SMS enabled — this endpoint is the one
     *  exception to read-only, but it still goes through SmsService's
     *  4-layer gate so it can't bypass the tenant-enabled check. */
    @PostMapping("/test")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SmsAuditLogDto>> sendTest(
            @Valid @RequestBody SendTestSmsRequest req,
            @AuthenticationPrincipal String userId) {
        SmsAuditLog result = smsService.sendTest(req.getPhone(), userId);
        return ResponseEntity.ok(ApiResponse.success(
                SmsAuditLogDto.from(result, false),
                "Test SMS dispatched"));
    }

    /** Picker data for the manual "Send today's absent SMS" flow.
     *
     *  Returns every student marked ABSENT in any attendance batch today,
     *  deduped by studentId. Each row carries the student's class label,
     *  parent's masked phone, the periods they were absent in, and a flag
     *  for whether an SMS was already sent today (so the UI can
     *  pre-uncheck those).
     *
     *  Empty array is a valid response — means no attendance has been
     *  saved yet today, OR no one was absent. UI shows an "All present"
     *  empty state in that case. */
    @GetMapping("/absent-today")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<AbsentTodayDto>>> listAbsentToday() {
        return ResponseEntity.ok(ApiResponse.success(smsService.listAbsentToday()));
    }

    /** Manual dispatch — admin clicked "Send SMS" after reviewing the picker.
     *
     *  Body carries the ticked studentIds. Backend dedupes against any
     *  audit row already SENT/PENDING for that student today, then fires
     *  one SMS per remaining student. Returns three counts so the UI
     *  snackbar can be specific ("Queued 8 · 3 already sent · 1 no phone"). */
    @PostMapping("/send-absent-today")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SendAbsentTodayResponse>> sendAbsentToday(
            @Valid @RequestBody SendAbsentTodayRequest req,
            @AuthenticationPrincipal String userId) {
        SendAbsentTodayResponse res = smsService.sendAbsenceAlertsForToday(req.getStudentIds(), userId);
        String msg = String.format(
                "Queued %d · %d already sent today · %d had no phone",
                res.getQueued(), res.getSkippedAlreadySent(), res.getSkippedNoPhone());
        return ResponseEntity.ok(ApiResponse.success(res, msg));
    }

    /** Broadcast a custom SMS notice to a chosen audience.
     *
     *  Audiences (see {@link SendCustomNoticeRequest.Audience}):
     *   - {@code ALL} — every active user with a phone
     *   - {@code ALL_STUDENTS} — parents of every active student
     *   - {@code ALL_EMPLOYEES} — teachers + principal + school admin
     *   - {@code CLASS} — parents of students in one specific class
     *
     *  Body length is capped at 300 chars to stay inside the DLT-approved
     *  CUSTOM_NOTICE template. The actual delivery is async — this
     *  endpoint returns once the fan-out is queued, with the recipient
     *  count so the admin can verify the audience size in the snackbar
     *  before opening the audit log to watch deliveries land. */
    @PostMapping("/custom-notice")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SendCustomNoticeResponse>> sendCustomNotice(
            @Valid @RequestBody SendCustomNoticeRequest req,
            @AuthenticationPrincipal String userId) {
        SendCustomNoticeResponse res = smsService.sendCustomNotice(req, userId);
        return ResponseEntity.ok(ApiResponse.success(
                res, "Custom notice queued to " + res.getRecipientCount() + " recipient(s)"));
    }

    /**
     * Send a holiday / closure SMS to the chosen audience. Uses the
     * tenant's HOLIDAY_NOTICE DLT template (configured by Super Admin
     * on the SMS Control page's expanded row). Throws 4xx with a clear
     * message when the template hasn't been pasted yet.
     */
    @PostMapping("/holiday-notice")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SendHolidayNoticeResponse>> sendHolidayNotice(
            @Valid @RequestBody SendHolidayNoticeRequest req,
            @AuthenticationPrincipal String userId) {
        SendHolidayNoticeResponse res = smsService.sendHolidayNotice(req, userId);
        return ResponseEntity.ok(ApiResponse.success(
                res, "Holiday notice queued to " + res.getRecipientCount() + " recipient(s)"));
    }

    /**
     * Send an event SMS — fired from the per-event "Send SMS" action on
     * the school admin's Events page. Uses the tenant's EVENT_NOTICE
     * DLT template. Same error semantics as holiday-notice — clear 4xx
     * when the template isn't configured.
     */
    @PostMapping("/event-notice")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SendEventNoticeResponse>> sendEventNotice(
            @Valid @RequestBody SendEventNoticeRequest req,
            @AuthenticationPrincipal String userId) {
        SendEventNoticeResponse res = smsService.sendEventNotice(req, userId);
        return ResponseEntity.ok(ApiResponse.success(
                res, "Event notice queued to " + res.getRecipientCount() + " recipient(s)"));
    }

    /**
     * Picker data for the "Publish Result SMS" card — every distinct
     * Exam.examType in the tenant grouped with the (classId, sectionId)
     * pairs it appears in. Catalog exam types that have no Exam docs
     * (never conducted) drop out, so the dropdown only lists results
     * the admin can actually publish.
     */
    @GetMapping("/result-notice/exam-types")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<List<ConductedExamTypeDto>>> listConductedExamTypes() {
        return ResponseEntity.ok(ApiResponse.success(
                resultPublicationService.listConductedExamTypes()));
    }

    /**
     * Multi-section "Publish Result SMS" — fan a RESULT_COMBINED SMS out
     * to every parent in the picked (classId, sectionId) pairs. Each SMS
     * is personalised: var1=student name, var2=exam name, var3=result
     * summary computed from THAT student's marks.
     *
     * <p>Phone numbers come from both {@code Student.parentPhone} (raw
     * field) AND linked Parent User accounts, deduped by phone inside
     * SmsService.</p>
     */
    @PostMapping("/result-notice")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<SendResultNoticeResponse>> sendResultNotice(
            @Valid @RequestBody SendResultNoticeRequest req,
            @AuthenticationPrincipal String userId) {
        SendResultNoticeResponse res = resultPublicationService.publishMultiSectionSms(req, userId);
        return ResponseEntity.ok(ApiResponse.success(
                res,
                "Result SMS queued — " + res.getStudentsCovered() + " student(s) across "
                        + res.getSectionsCovered() + " section(s)"));
    }

    /**
     * Read-only view of the current tenant's per-trigger DLT templates.
     * Drives the school admin's "available templates" status badges and
     * gates the Send buttons (e.g. Holiday Notice button is disabled if
     * the template's missing).
     */
    @GetMapping("/templates")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<Map<String, TenantSmsSettings.SmsTemplate>>> getMyTemplates() {
        String tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(ApiResponse.success(smsService.getTenantTemplates(tenantId)));
    }
}
