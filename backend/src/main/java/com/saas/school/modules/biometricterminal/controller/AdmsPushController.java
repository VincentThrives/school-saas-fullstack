package com.saas.school.modules.biometricterminal.controller;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometricterminal.model.AttendanceScan;
import com.saas.school.modules.biometricterminal.model.TerminalUserBinding;
import com.saas.school.modules.biometricterminal.service.AttendanceScanService;
import com.saas.school.modules.biometricterminal.service.TerminalRegistrationService;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * ADMS ("Anti-passback Data Management System" — eSSL / ZKTeco's
 * cloud-push protocol) receiver. Terminals hit these endpoints from
 * their own network on a fixed cadence; auth is by
 * (schoolCode + registered SN), NOT JWT — a terminal has no way to sign
 * a Bearer token. All three endpoints are wildcard-allowlisted in
 * {@code SecurityConfig.PUBLIC_ENDPOINTS}.
 *
 * <p>Every response body ends with a literal newline — some firmwares
 * silently reject a bare "OK" and start replaying scans until they get
 * the expected shape.</p>
 */
@RestController
@RequestMapping("/api/v1/adms/{schoolCode}/iclock")
public class AdmsPushController {

    private static final Logger log = LoggerFactory.getLogger(AdmsPushController.class);

    /** eSSL sends "yyyy-MM-dd HH:mm:ss" (space-separated) in the terminal's
     *  configured local timezone. We interpret it as JVM-default zone —
     *  same convention the teacher-marked attendance flow uses. */
    private static final DateTimeFormatter ADMS_TIMESTAMP =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private static final String ACK = "OK\n";

    @Autowired private TenantRepository tenantRepository;
    @Autowired private TerminalRegistrationService registrationService;
    @Autowired private AttendanceScanService scanService;

    /**
     * The workhorse endpoint. Terminals POST here every time a new scan
     * is buffered; body is a tab-separated log with one line per event.
     *
     * <p>Fields per line (eSSL AiFace / ZKTeco variant):
     * {@code userId \t timestamp \t status \t verifyMode \t workcode \t reserved1 \t reserved2}.
     * We use {@code userId}, {@code timestamp}, and {@code status} (mapped
     * to IN/OUT). The rest is ignored but tolerated.</p>
     *
     * <p>Never crashes: even a malformed body returns 200 OK so the
     * terminal doesn't stall its upload queue.</p>
     */
    @PostMapping(value = "/cdata", consumes = MediaType.ALL_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> cdata(
            @PathVariable String schoolCode,
            @RequestParam(value = "SN", required = false) String sn,
            @RequestBody(required = false) String body,
            HttpServletRequest request) {

        Tenant tenant = resolveTenant(schoolCode);
        if (tenant == null) {
            log.warn("ADMS cdata for unknown schoolCode='{}' from ip={}", schoolCode, ipOf(request));
            return ack();
        }
        String serial = normaliseSerial(sn);
        if (serial == null || body == null || body.isBlank()) {
            // Empty POSTs happen — some firmwares POST an empty payload as
            // a heartbeat. Still bump lastSeenAt if we can identify the SN.
            if (serial != null) withTenant(tenant, () ->
                registrationService.updateLastSeen(serial, ipOf(request)));
            return ack();
        }

        withTenant(tenant, () -> {
            registrationService.updateLastSeen(serial, ipOf(request));
            for (String line : body.split("\\R")) {
                processLine(line, serial);
            }
        });
        return ack();
    }

    /** Heartbeat / command-fetch. Terminal polls this every few seconds
     *  asking "any new commands for me?". We just refresh lastSeenAt and
     *  reply with the empty ACK — no commands to push yet. */
    @GetMapping(value = "/getrequest", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRequest(
            @PathVariable String schoolCode,
            @RequestParam(value = "SN", required = false) String sn,
            HttpServletRequest request) {

        Tenant tenant = resolveTenant(schoolCode);
        String serial = normaliseSerial(sn);
        if (tenant != null && serial != null) {
            withTenant(tenant, () -> registrationService.updateLastSeen(serial, ipOf(request)));
        }
        return ack();
    }

    /** Ack path for commands we would have pushed via {@code getrequest}.
     *  No commands yet, so this is a placeholder that just keeps the
     *  terminal happy. */
    @PostMapping(value = "/devicecmd", consumes = MediaType.ALL_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> deviceCmd(
            @PathVariable String schoolCode,
            @RequestParam(value = "SN", required = false) String sn) {
        return ack();
    }

    // ── Internals ────────────────────────────────────────────────

    private void processLine(String line, String serial) {
        if (line == null) return;
        String trimmed = line.trim();
        if (trimmed.isEmpty()) return;

        String[] parts = trimmed.split("\t");
        if (parts.length < 3) {
            // Some firmwares use a two-space separator instead of tab —
            // fall back so we still catch the common fields.
            parts = trimmed.split("\\s{2,}");
            if (parts.length < 3) {
                log.debug("ADMS line skipped — too few fields: {}", trimmed);
                return;
            }
        }

        String terminalUserId = parts[0].trim();
        String rawTs = parts[1].trim();
        String rawStatus = parts[2].trim();

        Instant scannedAt = parseTimestamp(rawTs);
        if (scannedAt == null) {
            log.warn("ADMS line skipped — unparseable timestamp '{}' on SN {}", rawTs, serial);
            return;
        }
        AttendanceScan.Direction direction = parseDirection(rawStatus);

        Optional<TerminalUserBinding> binding = registrationService.resolveBinding(serial, terminalUserId);
        if (binding.isEmpty()) {
            log.warn("Unbound terminal user {} on SN {} — scan dropped", terminalUserId, serial);
            return;
        }

        String tenantId = TenantContext.getTenantId();
        try {
            scanService.recordScan(tenantId, binding.get().getStudentId(),
                serial, terminalUserId, direction, scannedAt);
        } catch (Exception e) {
            // Never bubble to the terminal — an exception here would
            // return 500 and the terminal would retry the whole batch.
            log.error("recordScan failed for SN {} student {}: {}",
                serial, binding.get().getStudentId(), e.getMessage(), e);
        }
    }

    private Instant parseTimestamp(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDateTime.parse(raw, ADMS_TIMESTAMP).atZone(ZONE).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    /** eSSL "status" byte: 0=IN, 1=OUT, 4=IN_OT, 5=OUT_OT. Anything
     *  we don't recognise falls back to IN — the terminal's real
     *  IN/OUT is set at enrolment time; unset devices only ever
     *  emit 0. */
    private AttendanceScan.Direction parseDirection(String raw) {
        if (raw == null) return AttendanceScan.Direction.IN;
        String t = raw.trim();
        return switch (t) {
            case "1", "3", "5" -> AttendanceScan.Direction.OUT;
            default -> AttendanceScan.Direction.IN;
        };
    }

    /** Look tenant up by subdomain — that's the identifier a school
     *  admin will paste into the terminal's "Cloud server address". */
    private Tenant resolveTenant(String schoolCode) {
        if (schoolCode == null || schoolCode.isBlank()) return null;
        return tenantRepository.findBySubdomainOrTenantId(schoolCode.trim().toLowerCase())
            .orElse(null);
    }

    private String normaliseSerial(String sn) {
        if (sn == null) return null;
        String t = sn.trim();
        return t.isEmpty() ? null : t.toUpperCase();
    }

    private String ipOf(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma >= 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    /** Runs {@code action} with the tenant's id installed in
     *  {@link TenantContext} so per-tenant Mongo routing takes effect,
     *  then clears the ThreadLocal. Public endpoints skip
     *  {@code JwtAuthFilter}, so nobody else does it for us. */
    private void withTenant(Tenant tenant, Runnable action) {
        String previous = TenantContext.getTenantId();
        try {
            TenantContext.setTenantId(tenant.getTenantId());
            action.run();
        } finally {
            if (previous == null) TenantContext.clear();
            else TenantContext.setTenantId(previous);
        }
    }

    private ResponseEntity<String> ack() {
        return ResponseEntity.ok(ACK);
    }
}
