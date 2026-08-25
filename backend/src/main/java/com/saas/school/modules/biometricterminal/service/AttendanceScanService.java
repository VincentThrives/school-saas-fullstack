package com.saas.school.modules.biometricterminal.service;

import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.biometricterminal.model.AttendanceScan;
import com.saas.school.modules.biometricterminal.model.BiometricSettings;
import com.saas.school.modules.biometricterminal.repository.AttendanceScanRepository;
import com.saas.school.modules.biometricterminal.repository.BiometricSettingsRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Core write-path for terminal-driven attendance. Every scan pushed by
 * an ADMS terminal (already tenant-scoped by the controller) lands here.
 * Handles dedup, status classification, ledger insert, roll-up into
 * StudentsAttendance and parent notifications — each side-effect wrapped
 * so a downstream failure never fails the whole scan.
 */
@Service
public class AttendanceScanService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceScanService.class);

    /** Terminals often fire the same face twice within a couple of seconds
     *  (retry logic, or the person hesitating in front of the camera).
     *  We collapse anything inside this window into one ledger row so
     *  the parent gets one push, not four. */
    private static final Duration DEDUP_WINDOW = Duration.ofSeconds(120);

    /** LATE / EARLY_LEAVE cutoffs are HH:mm strings interpreted in the
     *  JVM's default zone — matches how the rest of the system treats
     *  "today" (attendance date, timetable). All current tenants are in
     *  India — pin to Asia/Kolkata rather than trust the JVM default,
     *  which on Render is UTC and would roll days over 5.5 h early. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private static final String DEFAULT_LATE_CUTOFF = "09:15";
    private static final String DEFAULT_EARLIEST_EXIT = "14:00";

    @Autowired private AttendanceScanRepository scanRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentsAttendanceRepository studentsAttendanceRepository;
    @Autowired private BiometricSettingsRepository settingsRepository;
    @Autowired private NotificationService notificationService;

    /**
     * Persist a scan and everything downstream of it.
     *
     * <p>Called from {@code AdmsPushController} after tenant + student
     * have already been resolved. Idempotent inside {@link #DEDUP_WINDOW}
     * — a duplicate within the window returns the existing scan without
     * a second notification.</p>
     *
     * @return the saved (or previously-saved) scan, never null
     */
    public AttendanceScan recordScan(String tenantId,
                                     String studentId,
                                     String terminalSerial,
                                     String terminalUserId,
                                     AttendanceScan.Direction deviceDirection,
                                     Instant scannedAt) {

        LocalDate localDay = scannedAt.atZone(ZONE).toLocalDate();
        String dateKey = localDay.toString();

        // ── Retry dedup (short window) ────────────────────────────────
        // Terminals sometimes fire the same scan twice within a couple
        // of seconds (network retry, or the person hesitating in front
        // of the camera). Collapse anything inside DEDUP_WINDOW to one
        // ledger row regardless of direction so we don't create noise
        // in the audit table for network hiccups.
        Optional<AttendanceScan> existing = findRecentScan(studentId, dateKey, scannedAt);
        if (existing.isPresent()) {
            log.info("Dedup hit — reusing scan {} for student {} (within {}s window)",
                existing.get().getScanId(), studentId, DEDUP_WINDOW.getSeconds());
            return existing.get();
        }

        BiometricSettings settings = getSettings();

        // ── Decide whether this scan counts and, if so, what for ─────
        // The device's IN/OUT byte is advisory only — many eSSL setups
        // always report status=0. We make the call based on the
        // tenant's expected scans/day + arrival/exit windows, so an
        // extra tap in the middle of the school day gets silently
        // dropped instead of bumping the arrival time or mis-firing
        // a "left early" SMS.
        StudentsAttendance.StudentEntry existingEntry =
            findExistingEntry(studentId, localDay);
        ScanDecision decision = decide(existingEntry, scannedAt, settings);
        log.info("Scan decision: tenant={} student={} outcome={} direction={} reason={}",
            tenantId, studentId, decision.outcome, decision.direction, decision.reason);

        AttendanceScan scan = new AttendanceScan();
        scan.setScanId(UUID.randomUUID().toString());
        scan.setTenantId(tenantId);
        scan.setStudentId(studentId);
        scan.setTerminalSerial(terminalSerial);
        scan.setTerminalUserId(terminalUserId);
        scan.setMethod(AttendanceScan.ScanMethod.EXTERNAL_TERMINAL);
        // Direction on the record reflects OUR verdict on RECORDED scans,
        // else the device's byte on DROPPED (useful in the audit UI to
        // spot devices that always report the same direction).
        scan.setDirection(decision.direction != null ? decision.direction : deviceDirection);
        scan.setStatus(decision.status);
        scan.setScannedAt(scannedAt);
        scan.setScanDateKey(dateKey);
        scan.setOutcome(decision.outcome);
        scan.setDropReason(decision.reason);
        AttendanceScan saved = scanRepository.save(scan);

        // ── Dropped scans are audit-only from here ───────────────────
        if (decision.outcome != AttendanceScan.ScanOutcome.RECORDED) {
            return saved;
        }

        // ── Roll-up into StudentsAttendance ──────────────────────────
        // Isolated so a schema mismatch on the shared table can't cause
        // the terminal to see a 500 and start replaying scans.
        try {
            rollupToStudentsAttendance(studentId, localDay,
                decision.direction, decision.status, scannedAt);
            saved.setRolledUpAt(Instant.now());
            scanRepository.save(saved);
            log.info("Roll-up done: scan={} student={} day={} status={}",
                saved.getScanId(), studentId, localDay, decision.status);
        } catch (Exception e) {
            log.warn("Roll-up into StudentsAttendance failed for scan {} — ledger row kept: {}",
                saved.getScanId(), e.getMessage(), e);
        }

        // ── Notify parents ───────────────────────────────────────────
        try {
            maybeNotifyParents(saved, settings);
        } catch (Exception e) {
            log.warn("Parent notification failed for scan {}: {}", saved.getScanId(), e.getMessage(), e);
        }

        return saved;
    }

    /**
     * Ground-truth for how a scan is treated. See the tenant's
     * BiometricSettings — {@code expectedScansPerDay} caps the number
     * of meaningful scans per student per day, {@code earliestExitTime}
     * splits the day into an arrival window (before) and an exit
     * window (at/after).
     */
    private ScanDecision decide(StudentsAttendance.StudentEntry entry,
                                 Instant scannedAt,
                                 BiometricSettings settings) {
        // hasArrival: EITHER a fresh punchTime set by the new rollup OR
        // a status of PRESENT / LATE from a prior biometric roll-up that
        // ran BEFORE punchTime was added to the model (backward compat
        // for tenants that had the older code running when their first
        // scans landed). Also covers teacher-marked entries so a
        // teacher's manual PRESENT stops the next biometric tap from
        // being treated as arrival.
        boolean hasArrival = entry != null && (
            entry.getPunchTime() != null
                || "PRESENT".equalsIgnoreCase(entry.getStatus())
                || "LATE".equalsIgnoreCase(entry.getStatus())
        );
        boolean hasDeparture = entry != null && entry.getDepartureTime() != null;
        LocalTime scanTime = scannedAt.atZone(ZONE).toLocalTime();
        LocalTime lateCutoff = parseTime(settings.getLateCutoff(), DEFAULT_LATE_CUTOFF);
        LocalTime exitStart = parseTime(settings.getEarliestExitTime(), DEFAULT_EARLIEST_EXIT);
        int expected = Math.max(1, settings.getExpectedScansPerDay());

        if (!hasArrival) {
            // First scan of the day is always the arrival, even if it
            // lands after the exit window (kid arrived very late — we
            // still want to mark them present, just tagged LATE).
            AttendanceScan.ScanStatus status = scanTime.isAfter(lateCutoff)
                ? AttendanceScan.ScanStatus.LATE
                : AttendanceScan.ScanStatus.PRESENT;
            return ScanDecision.record(AttendanceScan.Direction.IN, status);
        }
        if (expected <= 1) {
            return ScanDecision.drop(
                AttendanceScan.ScanOutcome.DROPPED_DUPLICATE,
                "Arrival already recorded; school configured for 1 scan/day.");
        }
        if (hasDeparture) {
            return ScanDecision.drop(
                AttendanceScan.ScanOutcome.DROPPED_ALREADY_LEFT,
                "Both arrival and departure already recorded today.");
        }
        if (scanTime.isBefore(exitStart)) {
            return ScanDecision.drop(
                AttendanceScan.ScanOutcome.DROPPED_BEFORE_EXIT_WINDOW,
                "Scan before exit window (" + exitStart + ") — treated as accidental re-scan.");
        }
        return ScanDecision.record(
            AttendanceScan.Direction.OUT, AttendanceScan.ScanStatus.PRESENT);
    }

    /** Lookup helper — returns the student's day-wise entry for the
     *  given date, or null if the student has no class/section or the
     *  row doesn't exist yet. Used by {@link #decide} to answer the
     *  "already arrived / already departed?" questions. */
    private StudentsAttendance.StudentEntry findExistingEntry(String studentId, LocalDate day) {
        Student student = studentRepository
            .findByStudentIdAndDeletedAtIsNull(studentId).orElse(null);
        if (student == null || student.getClassId() == null || student.getSectionId() == null) {
            return null;
        }
        return studentsAttendanceRepository
            .findByClassIdAndSectionIdAndDateAndPeriodNumberAndSubjectIdAndComponentKeyAndSubPartKey(
                student.getClassId(), student.getSectionId(), day, 0, null, null, null)
            .map(row -> row.getEntries() == null ? null :
                row.getEntries().stream()
                    .filter(e -> studentId.equals(e.getStudentId()))
                    .findFirst()
                    .orElse(null))
            .orElse(null);
    }

    /** Verdict returned by {@link #decide}. Fields mirror what the
     *  scan row needs: outcome + a direction/status (RECORD only) +
     *  a reason (DROP only). Kept as a plain final-fields class rather
     *  than a record to stay compatible with the project's Java baseline. */
    private static final class ScanDecision {
        final AttendanceScan.ScanOutcome outcome;
        final AttendanceScan.Direction direction;
        final AttendanceScan.ScanStatus status;
        final String reason;

        private ScanDecision(AttendanceScan.ScanOutcome outcome,
                              AttendanceScan.Direction direction,
                              AttendanceScan.ScanStatus status,
                              String reason) {
            this.outcome = outcome;
            this.direction = direction;
            this.status = status;
            this.reason = reason;
        }
        static ScanDecision record(AttendanceScan.Direction dir, AttendanceScan.ScanStatus status) {
            return new ScanDecision(AttendanceScan.ScanOutcome.RECORDED, dir, status, null);
        }
        static ScanDecision drop(AttendanceScan.ScanOutcome outcome, String reason) {
            return new ScanDecision(outcome, null, null, reason);
        }
    }

    /** Newest scan for (student, day) inside the dedup window regardless
     *  of direction — we suppress network retries at the raw-scan level
     *  before the decide() step runs. Direction is no longer part of the
     *  lookup because we now derive direction from time, so two consecutive
     *  device pushes with different byte values but the same timestamp
     *  should still collapse to one row. */
    private Optional<AttendanceScan> findRecentScan(String studentId, String dateKey,
                                                     Instant scannedAt) {
        List<AttendanceScan> sameDay = new ArrayList<>();
        sameDay.addAll(scanRepository.findByStudentIdAndScanDateKeyAndDirection(
            studentId, dateKey, AttendanceScan.Direction.IN));
        sameDay.addAll(scanRepository.findByStudentIdAndScanDateKeyAndDirection(
            studentId, dateKey, AttendanceScan.Direction.OUT));
        return sameDay.stream()
            .filter(s -> s.getScannedAt() != null)
            .filter(s -> Duration.between(s.getScannedAt(), scannedAt).abs().compareTo(DEDUP_WINDOW) <= 0)
            .max(Comparator.comparing(AttendanceScan::getScannedAt));
    }

    private LocalTime parseTime(String hhmm, String fallback) {
        String value = (hhmm == null || hhmm.isBlank()) ? fallback : hhmm;
        try {
            return LocalTime.parse(value);
        } catch (Exception e) {
            log.warn("Invalid time '{}' in biometric settings — falling back to {}", value, fallback);
            return LocalTime.parse(fallback);
        }
    }

    // (settingsOrDefault removed — replaced by getSettings() which reads
    //  the singleton doc directly out of the current tenant DB.)

    /**
     * Upsert the student's status onto today's day-wise StudentsAttendance
     * row (periodNumber=0). Never overwrites an ABSENT/PRESENT already
     * marked by a teacher unless the terminal has a stronger signal —
     * for now we always let the terminal win, since it's the source of
     * truth for "did the child physically enter the campus".
     *
     * <p>Terminals can't tell us subjectId / componentKey / subPartKey,
     * so those stay null — matches the day-wise shape teachers already
     * use.</p>
     */
    private void rollupToStudentsAttendance(String studentId, LocalDate day,
                                             AttendanceScan.Direction direction,
                                             AttendanceScan.ScanStatus status,
                                             Instant scannedAt) {
        Student student = studentRepository.findByStudentIdAndDeletedAtIsNull(studentId).orElse(null);
        if (student == null || student.getClassId() == null || student.getSectionId() == null) {
            log.warn("Cannot roll up scan for student {} — student={} class={} section={}",
                studentId, student, student == null ? null : student.getClassId(),
                student == null ? null : student.getSectionId());
            return;
        }
        log.info("Roll-up target: class={} section={} date={} student={}",
            student.getClassId(), student.getSectionId(), day, studentId);

        StudentsAttendance row = studentsAttendanceRepository
            .findByClassIdAndSectionIdAndDateAndPeriodNumberAndSubjectIdAndComponentKeyAndSubPartKey(
                student.getClassId(), student.getSectionId(), day, 0, null, null, null)
            .orElseGet(() -> {
                StudentsAttendance fresh = new StudentsAttendance();
                fresh.setClassId(student.getClassId());
                fresh.setSectionId(student.getSectionId());
                fresh.setAcademicYearId(student.getAcademicYearId());
                fresh.setDate(day);
                fresh.setPeriodNumber(0);
                fresh.setEntries(new ArrayList<>());
                fresh.setMarkedBy("BIOMETRIC_TERMINAL");
                return fresh;
            });

        if (row.getEntries() == null) row.setEntries(new ArrayList<>());
        // Reports, dashboards and the teacher grid all key off `status`.
        // We keep it as PRESENT for anyone the biometric confirmed as
        // attending — lateness rides on the sibling {punchTime, late}
        // fields so no downstream code has to special-case a LATE bucket.
        StudentsAttendance.StudentEntry entry = row.getEntries().stream()
            .filter(e -> studentId.equals(e.getStudentId()))
            .findFirst()
            .orElse(null);
        if (entry == null) {
            entry = new StudentsAttendance.StudentEntry(studentId, "PRESENT", null);
            row.getEntries().add(entry);
        } else {
            entry.setStatus("PRESENT");
        }
        // decide() already guaranteed this is the first-of-kind scan
        // (first arrival for IN, first departure for OUT). No guard
        // needed here — subsequent scans of the same kind are dropped
        // before reaching this method.
        if (direction == AttendanceScan.Direction.IN) {
            entry.setPunchTime(scannedAt);
            entry.setLate(status == AttendanceScan.ScanStatus.LATE);
        } else if (direction == AttendanceScan.Direction.OUT) {
            entry.setDepartureTime(scannedAt);
        }
        studentsAttendanceRepository.save(row);
    }

    /** Fire a per-parent push based on the tenant's notify toggles. Uses
     *  NotificationService directly (no rule engine template needed for
     *  the first cut). Fails silently — the calling try/catch is the
     *  safety net. */
    private void maybeNotifyParents(AttendanceScan scan, BiometricSettings settings) {
        // Notify toggles are now purely direction-based since we no
        // longer classify OUT scans as EARLY_LEAVE (the exit-window
        // config replaces that). isNotifyOnEarlyLeave stays on the
        // settings model for backward compat but is unused here.
        boolean shouldNotify = scan.getDirection() == AttendanceScan.Direction.IN
            ? settings.isNotifyOnEntry()
            : settings.isNotifyOnExit();
        if (!shouldNotify) {
            log.info("Notify skipped: direction={} — tenant toggles say no.",
                scan.getDirection());
            return;
        }

        Student student = studentRepository.findByStudentIdAndDeletedAtIsNull(scan.getStudentId()).orElse(null);
        if (student == null) {
            log.warn("Notify skipped: student {} not found", scan.getStudentId());
            return;
        }

        // In this product, the parent logs in AS the student — Student.userId
        // is the shared login. Prefer explicit parentIds if a school has
        // linked them separately; otherwise fall back to the student's own
        // userId so the app-side push lands in the right session.
        // Mirrors SmsService.collectStudentParentUserIds so both channels
        // reach the same audience.
        List<String> recipientUserIds = new ArrayList<>();
        if (student.getParentIds() != null && !student.getParentIds().isEmpty()) {
            recipientUserIds.addAll(student.getParentIds());
        } else if (student.getUserId() != null) {
            recipientUserIds.add(student.getUserId());
        }
        if (recipientUserIds.isEmpty()) {
            log.warn("Notify skipped: student {} has no userId and no parentIds",
                scan.getStudentId());
            return;
        }
        // Concise INFO for the operational log; verbose diagnostic
        // (individual ids, parentIds) drops to DEBUG so a busy school
        // doesn't drown INFO with 500+ lines a day.
        log.info("Notify firing: student={} recipients={} status={}",
            scan.getStudentId(), recipientUserIds.size(), scan.getStatus());
        if (log.isDebugEnabled()) {
            log.debug("Notify recipients detail: student.userId={} parentIds={} chosen={}",
                student.getUserId(), student.getParentIds(), recipientUserIds);
        }

        String childName = displayName(student);
        // Simple wording — parents get the exact time in the body, so they
        // can judge "on time / late" themselves without the app second-
        // guessing them (a re-scan past cutoff previously read "arrived
        // late" even for a kid who really came at 08:45).
        String title = scan.getDirection() == AttendanceScan.Direction.IN
            ? childName + " entered school"
            : childName + " left school";
        String body = "Recorded at " + scan.getScannedAt().atZone(ZONE).toLocalTime().withNano(0)
            + " on " + scan.getScanDateKey();

        Notification n = new Notification();
        n.setTitle(title);
        n.setBody(body);
        n.setType(Notification.NotificationType.ATTENDANCE);
        n.setChannel(Notification.Channel.IN_APP);
        n.setRecipientType(Notification.RecipientType.INDIVIDUAL);
        n.setRecipientIds(recipientUserIds);
        // SYSTEM sender — appendSenderSignature no-ops because no matching
        // User document exists for this id, keeping the body clean.
        notificationService.send(n, "SYSTEM");
    }

    private String displayName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last = s.getLastName() == null ? "" : s.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (s.getAdmissionNumber() != null) return "Student " + s.getAdmissionNumber();
        return "Your child";
    }

    // ── Access to the current tenant's biometric settings ────────────
    //    Reads the singleton doc from the tenant DB — TenantContext is
    //    already set by the caller (controller / filter).
    public BiometricSettings getSettings() {
        return settingsRepository.findById(BiometricSettings.SINGLETON_ID)
            .orElseGet(BiometricSettings::new);
    }
}
