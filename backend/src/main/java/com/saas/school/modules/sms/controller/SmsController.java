package com.saas.school.modules.sms.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.sms.dto.AbsentTodayDto;
import com.saas.school.modules.sms.dto.SendAbsentTodayRequest;
import com.saas.school.modules.sms.dto.SendAbsentTodayResponse;
import com.saas.school.modules.sms.dto.SendCustomNoticeRequest;
import com.saas.school.modules.sms.dto.SendCustomNoticeResponse;
import com.saas.school.modules.sms.dto.SendTestSmsRequest;
import com.saas.school.modules.sms.dto.SmsAuditLogDto;
import com.saas.school.modules.sms.dto.TenantSmsSettingsDto;
import com.saas.school.modules.sms.model.SmsAuditLog;
import com.saas.school.modules.sms.repository.SmsAuditLogRepository;
import com.saas.school.modules.sms.service.SmsService;
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
     *  recipients without exposing full phones in screenshots. */
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<SmsAuditLogDto>>> myAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        String tenantId = TenantContext.getTenantId();
        PageRequest pr = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<SmsAuditLog> result = auditRepo.findByTenantIdOrderByCreatedAtDesc(tenantId, pr);
        List<SmsAuditLogDto> dtos = result.getContent().stream()
                .map(l -> SmsAuditLogDto.from(l, true))   // mask phones for tenant view
                .toList();
        return ResponseEntity.ok(ApiResponse.success(
                PageResponse.of(dtos, result.getTotalElements(), page, size)));
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
}
