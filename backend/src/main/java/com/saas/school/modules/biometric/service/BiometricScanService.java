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

        // Idempotency check — one scan per student per day per tenant.
        LocalDate today = now.atZone(ZoneId.systemDefault()).toLocalDate();
        String dateKey = today.toString();
        Optional<AttendanceScan> existing = scanRepository
                .findByTenantIdAndStudentIdAndScanDateKey(tenantId, student.getStudentId(), dateKey);

        if (existing.isPresent()) {
            return toResponse(existing.get(), student, tenant, true);
        }

        AttendanceScan.ScanStatus status = decideStatus(now, settings);

        AttendanceScan scan = new AttendanceScan();
        scan.setScanId(UUID.randomUUID().toString());
        scan.setTenantId(tenantId);
        scan.setStudentId(student.getStudentId());
        scan.setDeviceId(deviceId);
        scan.setMethod(req.getMethod());
        scan.setStatus(status);
        scan.setScannedAt(now);
        scan.setScanDateKey(dateKey);
        try {
            scan = scanRepository.save(scan);
        } catch (DuplicateKeyException e) {
            // Lost a race with a concurrent duplicate scan — resolve to
            // the winner and return it as alreadyMarked.
            AttendanceScan winner = scanRepository
                    .findByTenantIdAndStudentIdAndScanDateKey(tenantId, student.getStudentId(), dateKey)
                    .orElseThrow(() -> e);
            return toResponse(winner, student, tenant, true);
        }

        // Materialise into the existing StudentsAttendance so teacher
        // Mark Attendance UI shows the row without any migration work.
        materialise(scan, student, today);

        // Update device last-seen — cheap and useful for the admin's
        // Kiosk Devices health page.
        device.setLastSeenAt(now);
        deviceRepository.save(device);

        auditService.log("BIOMETRIC_SCAN", "AttendanceScan", scan.getScanId(),
                "method=" + scan.getMethod()
                        + " student=" + student.getStudentId()
                        + " status=" + scan.getStatus()
                        + " device=" + deviceId);

        return toResponse(scan, student, tenant, false);
    }

    // ── Roster bundle for the kiosk ──────────────────────────

    public List<KioskRosterEntry> buildRosterBundle() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) throw new BusinessException("No tenant context.");

        // For phase 1 pilot we send all live students. For very large
        // tenants a class-scoped bundle would be leaner — punt on that
        // until we hit real scale.
        List<Student> all = studentRepository.findAll();
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

    private LocalTime parseHhmm(String s, LocalTime fallback) {
        if (s == null || !s.matches("\\d{1,2}:\\d{2}")) return fallback;
        String[] parts = s.split(":");
        try {
            return LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
        } catch (Exception e) { return fallback; }
    }

    private void materialise(AttendanceScan scan, Student student, LocalDate day) {
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
            String status = scan.getStatus().name();  // PRESENT / LATE
            boolean found2 = false;
            for (StudentsAttendance.StudentEntry e : entries) {
                if (student.getStudentId().equals(e.getStudentId())) {
                    e.setStatus(status);
                    found2 = true;
                    break;
                }
            }
            if (!found2) {
                entries.add(new StudentsAttendance.StudentEntry(student.getStudentId(), status, null));
            }
            doc.setEntries(entries);
            doc.setMarkedBy("BIOMETRIC_SCAN:" + scan.getMethod());
            studentsAttendanceRepository.save(doc);
            scan.setRolledUpAt(Instant.now());
            scanRepository.save(scan);
        } catch (Exception e) {
            // Materialisation is not the source of truth — attendance_scans
            // is. If this fails, log and move on; a nightly reconciliation
            // job (phase 2) would catch drift.
            log.warn("Materialise-to-students_attendance failed for scan {}: {}",
                    scan.getScanId(), e.getMessage());
        }
    }

    private ScanResponse toResponse(AttendanceScan scan, Student student, Tenant tenant, boolean alreadyMarked) {
        ScanResponse r = new ScanResponse();
        r.setStudentId(student.getStudentId());
        r.setName(displayName(student));
        r.setRollNumber(student.getRollNumber());
        // Class name is a "class-section" convenience string for the kiosk card.
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
        r.setStatus(scan.getStatus().name());
        r.setScannedAt(scan.getScannedAt().toString());
        r.setAlreadyMarked(alreadyMarked);
        r.setMethod(scan.getMethod().name());
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
