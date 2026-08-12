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
                                     AttendanceScan.Direction direction,
                                     Instant scannedAt) {

        LocalDate localDay = scannedAt.atZone(ZONE).toLocalDate();
        String dateKey = localDay.toString();

        // ── Dedup ─────────────────────────────────────────────────────
        Optional<AttendanceScan> existing = findRecentScan(studentId, dateKey, direction, scannedAt);
        if (existing.isPresent()) {
            log.info("Dedup hit — reusing scan {} for student {} (within {}s window)",
                existing.get().getScanId(), studentId, DEDUP_WINDOW.getSeconds());
            return existing.get();
        }

        BiometricSettings settings = getSettings();
        AttendanceScan.ScanStatus status = classify(direction, scannedAt, settings);
        log.info("Scan received: tenant={} student={} direction={} status={} SN={} scannedAt={}",
            tenantId, studentId, direction, status, terminalSerial, scannedAt);

        AttendanceScan scan = new AttendanceScan();
        scan.setScanId(UUID.randomUUID().toString());
        scan.setTenantId(tenantId);
        scan.setStudentId(studentId);
        scan.setTerminalSerial(terminalSerial);
        scan.setTerminalUserId(terminalUserId);
        scan.setMethod(AttendanceScan.ScanMethod.EXTERNAL_TERMINAL);
        scan.setDirection(direction);
        scan.setStatus(status);
        scan.setScannedAt(scannedAt);
        scan.setScanDateKey(dateKey);
        AttendanceScan saved = scanRepository.save(scan);

        // ── Roll-up into StudentsAttendance ──────────────────────────
        // Isolated so a schema mismatch on the shared table can't cause
        // the terminal to see a 500 and start replaying scans.
        try {
            rollupToStudentsAttendance(studentId, localDay, status);
            saved.setRolledUpAt(Instant.now());
            scanRepository.save(saved);
            log.info("Roll-up done: scan={} student={} day={} status={}",
                saved.getScanId(), studentId, localDay, status);
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

    /** Newest scan for (student, day, direction) inside the dedup window,
     *  or empty if none. */
    private Optional<AttendanceScan> findRecentScan(String studentId, String dateKey,
                                                     AttendanceScan.Direction direction,
                                                     Instant scannedAt) {
        List<AttendanceScan> sameDay =
            scanRepository.findByStudentIdAndScanDateKeyAndDirection(studentId, dateKey, direction);
        return sameDay.stream()
            .filter(s -> s.getScannedAt() != null)
            .filter(s -> Duration.between(s.getScannedAt(), scannedAt).abs().compareTo(DEDUP_WINDOW) <= 0)
            .max(Comparator.comparing(AttendanceScan::getScannedAt));
    }

    /** Compare scan time against the tenant's cutoff to bucket the scan. */
    private AttendanceScan.ScanStatus classify(AttendanceScan.Direction direction,
                                                Instant scannedAt,
                                                BiometricSettings settings) {
        LocalTime scanTime = scannedAt.atZone(ZONE).toLocalTime();
        if (direction == AttendanceScan.Direction.IN) {
            LocalTime cutoff = parseTime(settings.getLateCutoff(), DEFAULT_LATE_CUTOFF);
            return scanTime.isAfter(cutoff)
                ? AttendanceScan.ScanStatus.LATE
                : AttendanceScan.ScanStatus.PRESENT;
        }
        LocalTime earliestExit = parseTime(settings.getEarliestExitTime(), DEFAULT_EARLIEST_EXIT);
        return scanTime.isBefore(earliestExit)
            ? AttendanceScan.ScanStatus.EARLY_LEAVE
            : AttendanceScan.ScanStatus.PRESENT;
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
                                             AttendanceScan.ScanStatus status) {
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
        String storedStatus = toAttendanceStatus(status);
        StudentsAttendance.StudentEntry entry = row.getEntries().stream()
            .filter(e -> studentId.equals(e.getStudentId()))
            .findFirst()
            .orElse(null);
        if (entry == null) {
            row.getEntries().add(new StudentsAttendance.StudentEntry(studentId, storedStatus, null));
        } else {
            entry.setStatus(storedStatus);
        }
        studentsAttendanceRepository.save(row);
    }

    /** Bridge from ScanStatus to the StudentEntry status vocabulary
     *  (PRESENT / ABSENT / LATE / HALF_DAY) already used by the teacher
     *  grid. EARLY_LEAVE isn't in that vocabulary so it falls back to
     *  PRESENT — the child was here, just left early. */
    private String toAttendanceStatus(AttendanceScan.ScanStatus status) {
        return switch (status) {
            case LATE -> "LATE";
            case PRESENT, EARLY_LEAVE -> "PRESENT";
        };
    }

    /** Fire a per-parent push based on the tenant's notify toggles. Uses
     *  NotificationService directly (no rule engine template needed for
     *  the first cut). Fails silently — the calling try/catch is the
     *  safety net. */
    private void maybeNotifyParents(AttendanceScan scan, BiometricSettings settings) {
        boolean shouldNotify = switch (scan.getStatus()) {
            case EARLY_LEAVE -> settings.isNotifyOnEarlyLeave();
            default -> scan.getDirection() == AttendanceScan.Direction.IN
                ? settings.isNotifyOnEntry()
                : settings.isNotifyOnExit();
        };
        if (!shouldNotify) {
            log.info("Notify skipped: status={} direction={} — tenant toggles say no.",
                scan.getStatus(), scan.getDirection());
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
        String title = switch (scan.getStatus()) {
            case LATE -> childName + " arrived late";
            case EARLY_LEAVE -> childName + " left early";
            case PRESENT -> scan.getDirection() == AttendanceScan.Direction.IN
                ? childName + " entered school"
                : childName + " left school";
        };
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
