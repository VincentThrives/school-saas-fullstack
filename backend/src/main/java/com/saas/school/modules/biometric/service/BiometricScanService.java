package com.saas.school.modules.biometric.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.biometric.dto.KioskRosterEntry;
import com.saas.school.modules.biometric.dto.ScanRequest;
import com.saas.school.modules.biometric.dto.ScanResponse;
import com.saas.school.modules.biometric.model.AttendanceScan;
import com.saas.school.modules.biometric.model.ScannerDevice;
import com.saas.school.modules.biometric.model.StudentBiometric;
import com.saas.school.modules.biometric.repository.AttendanceScanRepository;
import com.saas.school.modules.biometric.repository.ScannerDeviceRepository;
import com.saas.school.modules.biometric.repository.StudentBiometricRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Ingests a scan from a paired tablet — resolves the student, decides
 * PRESENT vs LATE against the tenant's late cutoff, persists an
 * {@link AttendanceScan}, and materialises the same mark into the
 * existing {@code students_attendance} document so teachers' Mark
 * Attendance UI already shows it.
 *
 * <p>Idempotent by construction: the compound unique index on
 * {@code (tenantId, studentId, scanDateKey)} catches a duplicate submit
 * (network flake, student walking past twice) and the service returns
 * a friendly {@code alreadyMarked} response instead of a 500.</p>
 */
@Service
public class BiometricScanService {

    private static final Logger log = LoggerFactory.getLogger(BiometricScanService.class);

    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentBiometricRepository biometricRepository;
    @Autowired private AttendanceScanRepository scanRepository;
    @Autowired private ScannerDeviceRepository deviceRepository;
    @Autowired private StudentsAttendanceRepository studentsAttendanceRepository;
    @Autowired private SchoolClassRepository classRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private AuditService auditService;
    @Autowired private MongoTemplate mongoTemplate;

    /** Ignore duplicate scans in the same direction that arrive
     *  within this window — a student walking past the camera twice
     *  quickly, network retries, etc. */
    private static final long DEDUPE_WINDOW_SECONDS = 120;

    /** In AUTO mode, block auto-flipping IN → OUT within this window
     *  of the IN. Otherwise a student whose face is still in-frame
     *  after their IN would be marked OUT on the very next tick. */
    private static final long AUTO_MIN_OUT_GAP_SECONDS = 5 * 60;

    /**
     * Old versions of {@link AttendanceScan} carried a UNIQUE compound
     * index on {@code (tenantId, studentId, scanDateKey)} that blocked
     * a student from having both an IN and an OUT scan on the same
     * day. Punch-in/out requires two scans per day, so drop the old
     * index if it still exists on the tenant DB. Idempotent —
     * dropIndex on a missing index throws which we swallow.
     */
    @jakarta.annotation.PostConstruct
    void dropLegacyUniqueIndex() {
        try {
            mongoTemplate.indexOps("attendance_scans")
                    .dropIndex("unique_scan_per_student_per_day");
            log.info("Dropped legacy unique index on attendance_scans");
        } catch (Exception ignored) {
            // Index didn't exist on this DB — that's the normal case.
        }
    }

    // ── Main entry point (device-token authenticated) ────────

    public ScanResponse scan(ScanRequest req, String deviceId) {
        if (req == null || req.getMethod() == null) {
            throw new BusinessException("Method (CARD or FACE) is required.");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) throw new BusinessException("No tenant context on scan.");

        ScannerDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new BusinessException("Device not found."));

        Tenant tenant = loadTenant(tenantId);
        Tenant.BiometricSettings settings = tenant.getBiometricSettings();
        if (settings == null) throw new BusinessException("Biometric settings not configured.");

        Instant now = req.getScannedAt() != null && !req.getScannedAt().isBlank()
                ? Instant.parse(req.getScannedAt())
                : Instant.now();

        Student student = resolveStudent(req, settings);

        LocalDate today = now.atZone(ZoneId.systemDefault()).toLocalDate();
        String dateKey = today.toString();

        // Decide direction based on the tenant's exitTracking mode + any
        // scans this student already has today.
        List<AttendanceScan> todaysScans = scanRepository
                .findByTenantIdAndStudentIdAndScanDateKeyOrderByScannedAtAsc(
                        tenantId, student.getStudentId(), dateKey);
        String mode = settings.getExitTracking() == null ? "OFF"
                : settings.getExitTracking().toUpperCase();

        AttendanceScan latestIn  = findLatestByDirection(todaysScans, AttendanceScan.Direction.IN);
        AttendanceScan latestOut = findLatestByDirection(todaysScans, AttendanceScan.Direction.OUT);

        // OFF mode: single scan per day. Any existing scan wins.
        if ("OFF".equals(mode) && !todaysScans.isEmpty()) {
            return toResponse(todaysScans.get(0), student, tenant, true, todaysScans);
        }

        // Invariant for AUTO + MANUAL: once both IN and OUT are recorded
        // for the day, no further scans are accepted.
        if (latestIn != null && latestOut != null) {
            return toResponse(latestOut, student, tenant, true, todaysScans);
        }

        AttendanceScan.Direction direction;
        if ("MANUAL".equals(mode)) {
            direction = "OUT".equalsIgnoreCase(req.getDirection())
                    ? AttendanceScan.Direction.OUT
                    : AttendanceScan.Direction.IN;
            // Can't record OUT before an IN — surface a clear error to
            // the operator so they know to flip the toggle back to IN
            // (or the student needs to punch IN first).
            if (direction == AttendanceScan.Direction.OUT && latestIn == null) {
                throw new BusinessException(
                        displayName(student) + " has no entry yet today — cannot record exit.");
            }
            // Duplicate IN → treat as already marked (silent for the
            // operator, matches OFF-mode UX).
            if (direction == AttendanceScan.Direction.IN && latestIn != null) {
                return toResponse(latestIn, student, tenant, true, todaysScans);
            }
        } else {   // AUTO
            if (latestIn == null) {
                direction = AttendanceScan.Direction.IN;
            } else {
                // latestOut is null here (else the both-set branch above
                // would have returned). Have IN but no OUT — guard the
                // min-gap so face still-in-frame doesn't insta-flip.
                long sec = java.time.Duration.between(latestIn.getScannedAt(), now).getSeconds();
                if (sec < AUTO_MIN_OUT_GAP_SECONDS) {
                    return toResponse(latestIn, student, tenant, true, todaysScans);
                }
                direction = AttendanceScan.Direction.OUT;
            }
        }

        // Same-direction dedup (short-window) — belt-and-braces against
        // double-taps and network retries.
        AttendanceScan sameDirection = findLatestByDirection(todaysScans, direction);
        if (sameDirection != null &&
                java.time.Duration.between(sameDirection.getScannedAt(), now).getSeconds()
                        < DEDUPE_WINDOW_SECONDS) {
            return toResponse(sameDirection, student, tenant, true, todaysScans);
        }

        AttendanceScan scan = new AttendanceScan();
        scan.setScanId(UUID.randomUUID().toString());
        scan.setTenantId(tenantId);
        scan.setStudentId(student.getStudentId());
        scan.setDeviceId(deviceId);
        scan.setMethod(req.getMethod());
        scan.setDirection(direction);
        // IN → PRESENT / LATE against late cutoff.
        // OUT → PRESENT / EARLY_LEAVE against earliestExitTime.
        scan.setStatus(direction == AttendanceScan.Direction.IN
                ? decideStatus(now, settings)
                : decideExitStatus(now, settings));
        scan.setScannedAt(now);
        scan.setScanDateKey(dateKey);
        try {
            scan = scanRepository.save(scan);
        } catch (DuplicateKeyException e) {
            // Race with a concurrent same-direction scan — resolve to
            // the winner and return it as alreadyMarked.
            AttendanceScan winner = scanRepository
                    .findByTenantIdAndStudentIdAndScanDateKeyAndDirection(
                            tenantId, student.getStudentId(), dateKey, direction)
                    .orElseThrow(() -> e);
            return toResponse(winner, student, tenant, true, todaysScans);
        }

        // Refresh today's scans list so materialise + response see the
        // just-saved row without a second DB round-trip.
        todaysScans = new ArrayList<>(todaysScans);
        todaysScans.add(scan);

        // Push into StudentsAttendance so teachers see the row too.
        materialise(scan, student, today, todaysScans);

        device.setLastSeenAt(now);
        deviceRepository.save(device);

        auditService.log("BIOMETRIC_SCAN", "AttendanceScan", scan.getScanId(),
                "method=" + scan.getMethod()
                        + " direction=" + scan.getDirection()
                        + " student=" + student.getStudentId()
                        + " status=" + scan.getStatus()
                        + " device=" + deviceId);

        return toResponse(scan, student, tenant, false, todaysScans);
    }

    private AttendanceScan findLatestByDirection(
            List<AttendanceScan> scans, AttendanceScan.Direction dir) {
        AttendanceScan latest = null;
        for (AttendanceScan s : scans) {
            if (s.getDirection() != dir) continue;
            if (latest == null || s.getScannedAt().isAfter(latest.getScannedAt())) latest = s;
        }
        return latest;
    }

    // ── Roster bundle for the kiosk ──────────────────────────

    public List<KioskRosterEntry> buildRosterBundle() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) throw new BusinessException("No tenant context.");

        // For phase 1 pilot we send all live students. For very large
        // tenants a class-scoped bundle would be leaner — punt on that
        // until we hit real scale.
        List<Student> all = studentRepository.findAll();
        log.info("Kiosk roster fetch: tenant={} total={} liveCount={}",
                tenantId, all.size(),
                all.stream().filter(s -> s.getDeletedAt() == null).count());
        all = all.stream().filter(s -> s.getDeletedAt() == null).toList();

        Map<String, StudentBiometric> byId = new HashMap<>();
        List<String> ids = all.stream().map(Student::getStudentId).toList();
        for (StudentBiometric bio : biometricRepository.findByStudentIdIn(ids)) {
            byId.put(bio.getStudentId(), bio);
        }
        Map<String, String> classNames = buildClassNameMap(all);

        List<KioskRosterEntry> out = new ArrayList<>(all.size());
        for (Student s : all) {
            KioskRosterEntry e = new KioskRosterEntry();
            e.setStudentId(s.getStudentId());
            e.setName(displayName(s));
            e.setRollNumber(s.getRollNumber());
            e.setClassName(classNames.getOrDefault(sectionKey(s), s.getClassId()));
            e.setCardUid(s.getCardUid());
            StudentBiometric bio = byId.get(s.getStudentId());
            if (bio != null) {
                e.setPhotoBase64(bio.getPhotoBase64());
                e.setFaceEmbedding(bio.getFaceEmbedding());
            }
            out.add(e);
        }
        return out;
    }

    // ── Live scans today (admin health page) ─────────────────

    public List<AttendanceScan> listTodayScans() {
        String tenantId = TenantContext.getTenantId();
        String today = LocalDate.now().toString();
        return scanRepository.findByTenantIdAndScanDateKeyOrderByScannedAtDesc(tenantId, today);
    }

    // ── Today's scans as kiosk-friendly rows (device-token auth) ─────

    /** Same as {@link #listTodayScans()} but enriches each scan with
     *  the student's name / roll / class / photo so the kiosk's
     *  "Marked" tab can render prior scans on first boot. Rows are
     *  collapsed to one-per-student with the earliest IN and latest
     *  OUT merged, so a kid who punched IN then OUT appears once
     *  with both timestamps. */
    public List<KioskRosterEntry> listTodayScansForKiosk() {
        String tenantId = TenantContext.getTenantId();
        String today = LocalDate.now().toString();
        List<AttendanceScan> scans =
                scanRepository.findByTenantIdAndScanDateKeyOrderByScannedAtDesc(tenantId, today);
        if (scans.isEmpty()) return new ArrayList<>();

        // Collapse: keep the IN scan as the "primary" row per student
        // (or OUT if no IN exists — MANUAL mode edge case). We attach
        // the OUT timestamp on the response object.
        java.util.LinkedHashMap<String, AttendanceScan> primaryByStudent = new java.util.LinkedHashMap<>();
        java.util.Map<String, Instant> exitByStudent = new HashMap<>();
        java.util.Map<String, Instant> entryByStudent = new HashMap<>();
        for (AttendanceScan s : scans) {
            String sid = s.getStudentId();
            if (s.getDirection() == AttendanceScan.Direction.IN) {
                Instant existing = entryByStudent.get(sid);
                if (existing == null || s.getScannedAt().isBefore(existing)) {
                    entryByStudent.put(sid, s.getScannedAt());
                }
                if (!primaryByStudent.containsKey(sid)
                        || primaryByStudent.get(sid).getDirection() != AttendanceScan.Direction.IN) {
                    primaryByStudent.put(sid, s);
                }
            } else if (s.getDirection() == AttendanceScan.Direction.OUT) {
                Instant existing = exitByStudent.get(sid);
                if (existing == null || s.getScannedAt().isAfter(existing)) {
                    exitByStudent.put(sid, s.getScannedAt());
                }
                primaryByStudent.putIfAbsent(sid, s);
            } else {
                // Legacy scans with no direction — treat as IN.
                primaryByStudent.putIfAbsent(sid, s);
                if (!entryByStudent.containsKey(sid)) entryByStudent.put(sid, s.getScannedAt());
            }
        }
        List<AttendanceScan> collapsed = new ArrayList<>(primaryByStudent.values());

        // Bulk-fetch students + biometrics for the scanned IDs.
        List<String> studentIds = collapsed.stream().map(AttendanceScan::getStudentId).toList();
        Map<String, Student> studentById = new HashMap<>();
        for (Student s : studentRepository.findByStudentIdInAndDeletedAtIsNull(studentIds)) {
            studentById.put(s.getStudentId(), s);
        }
        Map<String, StudentBiometric> bioById = new HashMap<>();
        for (StudentBiometric b : biometricRepository.findByStudentIdIn(studentIds)) {
            bioById.put(b.getStudentId(), b);
        }
        Map<String, String> classNames = buildClassNameMap(new ArrayList<>(studentById.values()));

        List<KioskRosterEntry> out = new ArrayList<>(collapsed.size());
        for (AttendanceScan sc : collapsed) {
            Student s = studentById.get(sc.getStudentId());
            if (s == null) continue;
            KioskRosterEntry e = new KioskRosterEntry();
            e.setStudentId(s.getStudentId());
            e.setName(displayName(s));
            e.setRollNumber(s.getRollNumber());
            e.setClassName(classNames.getOrDefault(sectionKey(s), s.getClassId()));
            e.setCardUid(s.getCardUid());
            StudentBiometric bio = bioById.get(s.getStudentId());
            if (bio != null) e.setPhotoBase64(bio.getPhotoBase64());
            Instant inAt = entryByStudent.get(sc.getStudentId());
            Instant outAt = exitByStudent.get(sc.getStudentId());
            out.add(new KioskTodayScan(e,
                    sc.getStatus() != null ? sc.getStatus().name() : "PRESENT",
                    sc.getScannedAt().toString(),
                    sc.getMethod().name(),
                    inAt != null ? inAt.toString() : null,
                    outAt != null ? outAt.toString() : null));
        }
        return out;
    }

    /** Compound entry that carries both the roster info AND the scan's
     *  status/time — small subclass so the JSON response is one flat
     *  object per row without adding a whole new DTO file. */
    public static class KioskTodayScan extends KioskRosterEntry {
        private String status;
        private String scannedAt;
        private String method;
        private String entryAt;
        private String exitAt;

        public KioskTodayScan(KioskRosterEntry base, String status, String scannedAt,
                              String method, String entryAt, String exitAt) {
            setStudentId(base.getStudentId());
            setName(base.getName());
            setRollNumber(base.getRollNumber());
            setClassName(base.getClassName());
            setCardUid(base.getCardUid());
            setPhotoBase64(base.getPhotoBase64());
            setFaceEmbedding(base.getFaceEmbedding());
            this.status = status;
            this.scannedAt = scannedAt;
            this.method = method;
            this.entryAt = entryAt;
            this.exitAt = exitAt;
        }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getScannedAt() { return scannedAt; }
        public void setScannedAt(String scannedAt) { this.scannedAt = scannedAt; }

        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }

        public String getEntryAt() { return entryAt; }
        public void setEntryAt(String entryAt) { this.entryAt = entryAt; }

        public String getExitAt() { return exitAt; }
        public void setExitAt(String exitAt) { this.exitAt = exitAt; }
    }

    // ── Helpers ─────────────────────────────────────────────

    private Student resolveStudent(ScanRequest req, Tenant.BiometricSettings settings) {
        if (req.getMethod() == AttendanceScan.ScanMethod.CARD) {
            if (!settings.isCardEnabled()) {
                throw new BusinessException("Card scanning is turned off for this school.");
            }
            if (req.getCardUid() == null || req.getCardUid().isBlank()) {
                throw new BusinessException("Card UID is required for a card scan.");
            }
            List<Student> matches = studentRepository.findAll().stream()
                    .filter(s -> s.getDeletedAt() == null)
                    .filter(s -> req.getCardUid().equalsIgnoreCase(s.getCardUid()))
                    .toList();
            if (matches.isEmpty()) throw new BusinessException("This card is not mapped to any student.");
            if (matches.size() > 1) throw new BusinessException("This card is mapped to more than one student.");
            return matches.get(0);
        }
        // FACE — the tablet already matched locally and shipped the studentId.
        if (!settings.isFaceEnabled()) {
            throw new BusinessException("Face matching is turned off for this school.");
        }
        if (req.getMatchedStudentId() == null || req.getMatchedStudentId().isBlank()) {
            throw new BusinessException("Matched student ID is required for a face scan.");
        }
        return studentRepository.findById(req.getMatchedStudentId())
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException("Matched student not found."));
    }

    private AttendanceScan.ScanStatus decideStatus(Instant scannedAt, Tenant.BiometricSettings settings) {
        LocalTime scanTime = scannedAt.atZone(ZoneId.systemDefault()).toLocalTime();
        LocalTime cutoff = parseHhmm(settings.getLateCutoff(), LocalTime.of(9, 15));
        return scanTime.isAfter(cutoff)
                ? AttendanceScan.ScanStatus.LATE
                : AttendanceScan.ScanStatus.PRESENT;
    }

    /** OUT status: EARLY_LEAVE if the scan is before the tenant's
     *  earliestExitTime, PRESENT otherwise. */
    private AttendanceScan.ScanStatus decideExitStatus(Instant scannedAt, Tenant.BiometricSettings settings) {
        LocalTime scanTime = scannedAt.atZone(ZoneId.systemDefault()).toLocalTime();
        LocalTime earliest = parseHhmm(settings.getEarliestExitTime(), LocalTime.of(14, 0));
        return scanTime.isBefore(earliest)
                ? AttendanceScan.ScanStatus.EARLY_LEAVE
                : AttendanceScan.ScanStatus.PRESENT;
    }

    private LocalTime parseHhmm(String s, LocalTime fallback) {
        if (s == null || !s.matches("\\d{1,2}:\\d{2}")) return fallback;
        String[] parts = s.split(":");
        try {
            return LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
        } catch (Exception e) { return fallback; }
    }

    private void materialise(AttendanceScan scan, Student student, LocalDate day,
                             List<AttendanceScan> todaysScans) {
        try {
            Optional<StudentsAttendance> found = studentsAttendanceRepository
                    .findByClassIdAndSectionIdAndDateAndPeriodNumber(
                            student.getClassId(), student.getSectionId(), day, 0);
            StudentsAttendance doc = found.orElseGet(() -> {
                StudentsAttendance fresh = new StudentsAttendance();
                fresh.setClassId(student.getClassId());
                fresh.setSectionId(student.getSectionId());
                fresh.setAcademicYearId(student.getAcademicYearId());
                fresh.setDate(day);
                fresh.setPeriodNumber(0);
                fresh.setEntries(new ArrayList<>());
                return fresh;
            });
            List<StudentsAttendance.StudentEntry> entries = doc.getEntries() != null
                    ? new ArrayList<>(doc.getEntries())
                    : new ArrayList<>();

            // Compute the entry / exit timestamps from all of today's
            // scans (not just this one) so a late-arriving OUT doesn't
            // clobber an earlier IN.
            AttendanceScan inScan = null, outScan = null;
            for (AttendanceScan s : todaysScans) {
                if (s.getDirection() == AttendanceScan.Direction.IN
                        && (inScan == null || s.getScannedAt().isBefore(inScan.getScannedAt()))) {
                    inScan = s;
                }
                if (s.getDirection() == AttendanceScan.Direction.OUT
                        && (outScan == null || s.getScannedAt().isAfter(outScan.getScannedAt()))) {
                    outScan = s;
                }
            }

            // Status comes from the IN scan when present (PRESENT/LATE).
            // If only an OUT scan exists (impossible in AUTO but possible
            // in MANUAL if admin forgets the toggle), fall back to
            // whatever this scan says.
            String status = inScan != null
                    ? inScan.getStatus().name()
                    : scan.getStatus().name();

            StudentsAttendance.StudentEntry entry = null;
            for (StudentsAttendance.StudentEntry e : entries) {
                if (student.getStudentId().equals(e.getStudentId())) {
                    entry = e;
                    break;
                }
            }
            if (entry == null) {
                entry = new StudentsAttendance.StudentEntry(student.getStudentId(), status, null);
                entries.add(entry);
            } else {
                entry.setStatus(status);
            }
            if (inScan != null) entry.setEntryAt(inScan.getScannedAt());
            if (outScan != null) entry.setExitAt(outScan.getScannedAt());

            doc.setEntries(entries);
            doc.setMarkedBy("BIOMETRIC_SCAN:" + scan.getMethod());
            studentsAttendanceRepository.save(doc);
            scan.setRolledUpAt(Instant.now());
            scanRepository.save(scan);
        } catch (Exception e) {
            log.warn("Materialise-to-students_attendance failed for scan {}: {}",
                    scan.getScanId(), e.getMessage());
        }
    }

    private ScanResponse toResponse(AttendanceScan scan, Student student, Tenant tenant,
                                    boolean alreadyMarked, List<AttendanceScan> todaysScans) {
        ScanResponse r = new ScanResponse();
        r.setStudentId(student.getStudentId());
        r.setName(displayName(student));
        r.setRollNumber(student.getRollNumber());
        SchoolClass sc = classRepository.findById(student.getClassId()).orElse(null);
        String className = sc != null ? sc.getName() : student.getClassId();
        String sectionName = "";
        if (sc != null && sc.getSections() != null && student.getSectionId() != null) {
            for (SchoolClass.Section sec : sc.getSections()) {
                if (student.getSectionId().equals(sec.getSectionId())) {
                    sectionName = sec.getName() == null ? "" : sec.getName();
                    break;
                }
            }
        }
        r.setClassName(sectionName.isBlank() ? className : (className + " " + sectionName));
        StudentBiometric bio = biometricRepository.findByStudentId(student.getStudentId()).orElse(null);
        if (bio != null) r.setPhotoBase64(bio.getPhotoBase64());
        // Status comes from the IN scan when we have one — an OUT scan
        // doesn't change PRESENT/LATE.
        AttendanceScan inForStatus = todaysScans == null ? null : todaysScans.stream()
                .filter(s -> s.getDirection() == AttendanceScan.Direction.IN)
                .findFirst().orElse(null);
        r.setStatus((inForStatus != null ? inForStatus.getStatus() : scan.getStatus()).name());
        r.setScannedAt(scan.getScannedAt().toString());
        r.setAlreadyMarked(alreadyMarked);
        r.setMethod(scan.getMethod().name());
        r.setDirection(scan.getDirection() != null ? scan.getDirection().name() : "IN");

        // Include both entry + exit times so the kiosk's marked row can
        // show them ("08:47 IN → 15:30 OUT").
        if (todaysScans != null) {
            AttendanceScan in = null, out = null;
            for (AttendanceScan s : todaysScans) {
                if (s.getDirection() == AttendanceScan.Direction.IN
                        && (in == null || s.getScannedAt().isBefore(in.getScannedAt()))) in = s;
                if (s.getDirection() == AttendanceScan.Direction.OUT
                        && (out == null || s.getScannedAt().isAfter(out.getScannedAt()))) out = s;
            }
            if (in != null) r.setEntryAt(in.getScannedAt().toString());
            if (out != null) r.setExitAt(out.getScannedAt().toString());
        }
        return r;
    }

    private Tenant loadTenant(String tenantId) {
        String saved = TenantContext.getTenantId();
        TenantContext.clear();
        try {
            return tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new BusinessException("Tenant not found."));
        } finally {
            if (saved != null) TenantContext.setTenantId(saved);
        }
    }

    private String displayName(Student s) {
        String f = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String l = s.getLastName() == null ? "" : s.getLastName().trim();
        String name = (f + " " + l).trim();
        return name.isEmpty() ? (s.getAdmissionNumber() != null ? s.getAdmissionNumber() : s.getStudentId()) : name;
    }

    private String sectionKey(Student s) { return s.getClassId() + ":" + s.getSectionId(); }

    private Map<String, String> buildClassNameMap(List<Student> students) {
        Map<String, String> out = new HashMap<>();
        for (Student s : students) {
            String key = sectionKey(s);
            if (out.containsKey(key)) continue;
            SchoolClass sc = classRepository.findById(s.getClassId()).orElse(null);
            String label = sc == null ? s.getClassId() : sc.getName();
            if (sc != null && sc.getSections() != null && s.getSectionId() != null) {
                for (SchoolClass.Section sec : sc.getSections()) {
                    if (s.getSectionId().equals(sec.getSectionId())) {
                        label = (sc.getName() == null ? "" : sc.getName())
                                + " " + (sec.getName() == null ? "" : sec.getName());
                        break;
                    }
                }
            }
            out.put(key, label);
        }
        return out;
    }
}
