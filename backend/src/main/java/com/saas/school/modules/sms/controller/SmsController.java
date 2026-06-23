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
            @RequestParam(required = false) String dateTo) {
        String tenantId = TenantContext.getTenantId();

        Criteria criteria = Criteria.where("tenantId").is(tenantId);
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
