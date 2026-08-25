package com.saas.school.modules.biometricterminal.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometricterminal.dto.BindUserRequest;
import com.saas.school.modules.biometricterminal.dto.RegisterTerminalRequest;
import com.saas.school.modules.biometricterminal.dto.TerminalBindingResponse;
import com.saas.school.modules.biometricterminal.dto.TerminalResponse;
import com.saas.school.modules.biometricterminal.dto.TodayPunchDto;
import com.saas.school.modules.biometricterminal.dto.UnboundStudentDto;
import com.saas.school.modules.biometricterminal.dto.UpdateTerminalRequest;
import com.saas.school.modules.biometricterminal.model.AttendanceScan;
import com.saas.school.modules.biometricterminal.model.ScannerTerminal;
import com.saas.school.modules.biometricterminal.model.TerminalUserBinding;
import com.saas.school.modules.biometricterminal.repository.AttendanceScanRepository;
import com.saas.school.modules.biometricterminal.repository.ScannerTerminalRepository;
import com.saas.school.modules.biometricterminal.repository.TerminalUserBindingRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Admin-facing CRUD for {@link ScannerTerminal} and
 * {@link TerminalUserBinding}. Tenant scoping is implicit via
 * {@link TenantContext} — every finder is scoped to the current tenant's
 * database, and the collections aren't shared across tenants.
 */
@Service
public class TerminalRegistrationService {

    private static final Logger log = LoggerFactory.getLogger(TerminalRegistrationService.class);

    @Autowired private ScannerTerminalRepository terminalRepository;
    @Autowired private TerminalUserBindingRepository bindingRepository;
    @Autowired private AttendanceScanRepository scanRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;

    // ── Terminal CRUD ────────────────────────────────────────────

    public TerminalResponse register(RegisterTerminalRequest req) {
        String serial = normaliseSerial(req.getSerial());
        if (terminalRepository.existsByTerminalSerial(serial)) {
            throw new BusinessException("Terminal with serial '" + serial + "' is already registered");
        }
        ScannerTerminal t = new ScannerTerminal();
        t.setId(UUID.randomUUID().toString());
        t.setTenantId(TenantContext.getTenantId());
        t.setTerminalSerial(serial);
        t.setLabel(req.getLabel());
        ScannerTerminal saved = terminalRepository.save(t);
        log.info("Registered biometric terminal {} ({}) for tenant {}", serial, req.getLabel(), saved.getTenantId());
        return toResponse(saved, 0);
    }

    public List<TerminalResponse> list() {
        List<ScannerTerminal> terminals = terminalRepository.findAllByOrderByCreatedAtDesc();
        if (terminals.isEmpty()) return List.of();
        // Precompute today's scanDateKey once so per-terminal counts share it.
        // Pinned to IST (matches AttendanceScanService.ZONE) so "today" means
        // the school's local calendar day, not UTC's — Render runs on UTC.
        String todayKey = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString();
        return terminals.stream()
            .map(t -> enrichResponse(t, todayKey))
            .toList();
    }

    /** List variant with per-terminal activity fields populated. Runs a
     *  handful of small queries per terminal — bindings count, today's
     *  scan count, latest scan + student lookup. Acceptable for the tens
     *  of terminals a single tenant would ever register. */
    private TerminalResponse enrichResponse(ScannerTerminal t, String todayKey) {
        String serial = t.getTerminalSerial();
        long bindings = bindingRepository.countByTerminalSerial(serial);
        TerminalResponse dto = toResponse(t, bindings);
        // "N today" stays as RECORDED-only — that's the attendance-worthy
        // number, not raw device chatter.
        dto.setTodaysScanCount(scanRepository.countByTerminalSerialAndScanDateKeyAndOutcome(
            serial, todayKey, com.saas.school.modules.biometricterminal.model.AttendanceScan.ScanOutcome.RECORDED));
        // "Last punch" shows the most recent tap regardless of outcome —
        // otherwise a stream of dropped taps 30s ago and a real RECORDED
        // punch 2h ago made the "2m ago" heartbeat and the LAST PUNCH
        // time visibly disagree. The outcome is exposed so the card
        // can tag dropped taps with a "DROPPED" chip.
        scanRepository.findFirstByTerminalSerialOrderByScannedAtDesc(serial)
            .ifPresent(scan -> {
                dto.setLastScanAt(scan.getScannedAt());
                dto.setLastScanDirection(scan.getDirection() == null ? null : scan.getDirection().name());
                dto.setLastScanOutcome(scan.getOutcome() == null
                    ? com.saas.school.modules.biometricterminal.model.AttendanceScan.ScanOutcome.RECORDED.name()
                    : scan.getOutcome().name());
                studentRepository.findByStudentIdAndDeletedAtIsNull(scan.getStudentId())
                    .ifPresent(s -> dto.setLastScanStudentName(displayName(s)));
            });
        return dto;
    }

    public TerminalResponse updateLabel(String serial, UpdateTerminalRequest req) {
        ScannerTerminal t = requireTerminal(serial);
        t.setLabel(req.getLabel());
        ScannerTerminal saved = terminalRepository.save(t);
        return toResponse(saved, bindingRepository.countByTerminalSerial(serial));
    }

    public void delete(String serial) {
        ScannerTerminal t = requireTerminal(serial);
        // Remove bindings first — a re-registration of the same physical
        // device shouldn't inherit stale user mappings.
        List<TerminalUserBinding> bindings = bindingRepository.findByTerminalSerial(serial);
        if (!bindings.isEmpty()) bindingRepository.deleteAll(bindings);
        terminalRepository.delete(t);
        log.info("Deleted biometric terminal {} + {} bindings", serial, bindings.size());
    }

    /** Called by the ADMS controller on every push — cheap enough to run
     *  inline. Silently no-ops for unregistered serials so an unauthorised
     *  device doesn't accidentally create a row. */
    public void updateLastSeen(String serial, String pingIp) {
        terminalRepository.findByTerminalSerial(serial).ifPresent(t -> {
            t.setLastSeenAt(Instant.now());
            t.setLastPingIp(pingIp);
            terminalRepository.save(t);
        });
    }

    // ── Binding CRUD ─────────────────────────────────────────────

    public TerminalBindingResponse bindUser(String serial, BindUserRequest req, String adminUserId) {
        requireTerminal(serial);
        Student student = studentRepository.findByStudentIdAndDeletedAtIsNull(req.getStudentId())
            .orElseThrow(() -> new ResourceNotFoundException("Student", req.getStudentId()));

        // Guard against silently overwriting an existing binding on the
        // same terminal user id. Earlier behavior did `orElseGet + set`
        // which meant re-binding "6" to a different student wiped the
        // previous one without warning — admin didn't know they'd just
        // detached the old kid from the device.
        Optional<TerminalUserBinding> existing = bindingRepository
            .findByTerminalSerialAndTerminalUserId(serial, req.getTerminalUserId());
        if (existing.isPresent()
                && !existing.get().getStudentId().equals(student.getStudentId())) {
            Student conflictStudent = studentRepository
                .findByStudentIdAndDeletedAtIsNull(existing.get().getStudentId())
                .orElse(null);
            String conflictName = conflictStudent == null
                ? "another student" : displayName(conflictStudent);
            throw new BusinessException("Terminal user id '" + req.getTerminalUserId()
                + "' is already bound to " + conflictName
                + ". Remove that binding first, or bind this student to a different user id.");
        }

        TerminalUserBinding binding = existing.orElseGet(() -> {
            TerminalUserBinding fresh = new TerminalUserBinding();
            fresh.setId(UUID.randomUUID().toString());
            fresh.setTenantId(TenantContext.getTenantId());
            fresh.setTerminalSerial(serial);
            fresh.setTerminalUserId(req.getTerminalUserId());
            return fresh;
        });
        binding.setStudentId(student.getStudentId());
        binding.setBoundBy(adminUserId);
        binding.setBoundAt(Instant.now());
        TerminalUserBinding saved = bindingRepository.save(binding);
        return toBindingResponse(saved, student, classIndex(List.of(saved)));
    }

    public List<TerminalBindingResponse> listBindings(String serial) {
        requireTerminal(serial);
        List<TerminalUserBinding> bindings = bindingRepository.findByTerminalSerial(serial);
        if (bindings.isEmpty()) return List.of();

        List<String> studentIds = bindings.stream().map(TerminalUserBinding::getStudentId).distinct().toList();
        Map<String, Student> studentsById = studentRepository.findByStudentIdInAndDeletedAtIsNull(studentIds).stream()
            .collect(Collectors.toMap(Student::getStudentId, s -> s, (a, b) -> a));
        Map<String, ClassSectionLabel> classLabels = classIndex(bindings);

        List<TerminalBindingResponse> out = new ArrayList<>(bindings.size());
        for (TerminalUserBinding b : bindings) {
            Student s = studentsById.get(b.getStudentId());
            if (s == null) {
                // Student was soft-deleted after the binding was created —
                // still surface the row so the admin can unbind it.
                TerminalBindingResponse orphan = new TerminalBindingResponse();
                orphan.setTerminalUserId(b.getTerminalUserId());
                orphan.setStudentId(b.getStudentId());
                orphan.setStudentName("(deleted student)");
                orphan.setBoundAt(b.getBoundAt());
                orphan.setBoundBy(b.getBoundBy());
                out.add(orphan);
            } else {
                out.add(toBindingResponse(b, s, classLabels));
            }
        }
        return out;
    }

    public void unbind(String serial, String terminalUserId) {
        requireTerminal(serial);
        Optional<TerminalUserBinding> found =
            bindingRepository.findByTerminalSerialAndTerminalUserId(serial, terminalUserId);
        found.ifPresent(bindingRepository::delete);
    }

    /** Change the terminal-side user id on an existing binding. Common
     *  case: admin mistyped the enrolment PIN, or re-enrolled the student
     *  on the device and got a new slot number. Rejects when the new id
     *  is already taken by another binding on the same terminal. */
    public TerminalBindingResponse updateTerminalUserId(String serial,
                                                        String currentTerminalUserId,
                                                        String newTerminalUserId,
                                                        String adminUserId) {
        requireTerminal(serial);
        if (newTerminalUserId == null || newTerminalUserId.isBlank()) {
            throw new BusinessException("New terminal user id is required.");
        }
        String trimmed = newTerminalUserId.trim();
        TerminalUserBinding binding = bindingRepository
            .findByTerminalSerialAndTerminalUserId(serial, currentTerminalUserId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Binding", serial + "/" + currentTerminalUserId));

        if (trimmed.equals(binding.getTerminalUserId())) {
            // No-op — just return the current row so the UI can refresh.
            Student student = studentRepository
                .findByStudentIdAndDeletedAtIsNull(binding.getStudentId()).orElse(null);
            return toBindingResponse(binding, student, classIndex(List.of(binding)));
        }

        // Guard against clashing with another binding on the same terminal.
        Optional<TerminalUserBinding> clash =
            bindingRepository.findByTerminalSerialAndTerminalUserId(serial, trimmed);
        if (clash.isPresent()) {
            throw new BusinessException("Terminal user id '" + trimmed
                + "' is already bound to another student on this terminal.");
        }

        binding.setTerminalUserId(trimmed);
        binding.setBoundBy(adminUserId);
        binding.setBoundAt(Instant.now());
        TerminalUserBinding saved = bindingRepository.save(binding);
        Student student = studentRepository
            .findByStudentIdAndDeletedAtIsNull(saved.getStudentId()).orElse(null);
        return toBindingResponse(saved, student, classIndex(List.of(saved)));
    }

    /** Backdoor for the ADMS controller — same lookup path but no admin
     *  precondition (the "does this terminal exist" check happens in the
     *  controller against a different code path). */
    public Optional<TerminalUserBinding> resolveBinding(String serial, String terminalUserId) {
        return bindingRepository.findByTerminalSerialAndTerminalUserId(serial, terminalUserId);
    }

    /**
     * Today's punches for one terminal — includes both RECORDED and
     * DROPPED scans, newest first. Enriched with student names in one
     * batch fetch so the audit table doesn't do N + 1 lookups.
     */
    public List<TodayPunchDto> getTodaysPunches(String serial) {
        // Verify the terminal exists so the endpoint 404s cleanly for
        // typo'd serials instead of returning an empty list silently.
        requireTerminal(serial);
        String todayKey = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString();
        List<AttendanceScan> scans = scanRepository
            .findByTerminalSerialAndScanDateKeyOrderByScannedAtDesc(serial, todayKey);
        if (scans.isEmpty()) return List.of();

        // Batch student lookup — one query for all distinct studentIds
        // in the scan list, then dictionary-lookup while building rows.
        List<String> studentIds = scans.stream()
            .map(AttendanceScan::getStudentId)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .toList();
        Map<String, Student> studentIndex = studentRepository
            .findAllById(studentIds).stream()
            .filter(s -> s.getDeletedAt() == null)
            .collect(Collectors.toMap(Student::getStudentId, s -> s));

        return scans.stream().map(scan -> {
            TodayPunchDto dto = new TodayPunchDto();
            dto.setScanId(scan.getScanId());
            dto.setScannedAt(scan.getScannedAt());
            dto.setTerminalUserId(scan.getTerminalUserId());
            dto.setStudentId(scan.getStudentId());
            Student student = scan.getStudentId() == null ? null : studentIndex.get(scan.getStudentId());
            if (student != null) dto.setStudentName(displayName(student));
            dto.setDirection(scan.getDirection() == null ? null : scan.getDirection().name());
            dto.setOutcome(scan.getOutcome() == null
                ? AttendanceScan.ScanOutcome.RECORDED.name()
                : scan.getOutcome().name());
            dto.setDropReason(scan.getDropReason());
            return dto;
        }).toList();
    }

    /**
     * Students in this tenant who don't have a binding on ANY terminal.
     * Global view — used by the page-header "Unbound Students" button
     * so admins can see who's truly missing across the whole school.
     * (A per-terminal view would false-positive when different terminals
     * cover different classes — kid bound to terminal A shows as
     * "unbound" on terminal B, which isn't the admin's question.)
     */
    public List<UnboundStudentDto> getUnboundStudentsGlobal() {
        java.util.Set<String> boundStudentIds = bindingRepository.findAll().stream()
            .map(TerminalUserBinding::getStudentId)
            .collect(Collectors.toSet());
        return buildUnboundList(boundStudentIds);
    }

    /**
     * Students in this tenant who don't have a binding on the given
     * terminal — kept for potential future per-terminal audit views.
     * Currently unused by the frontend (see {@link #getUnboundStudentsGlobal}).
     */
    public List<UnboundStudentDto> getUnboundStudents(String serial) {
        requireTerminal(serial);
        java.util.Set<String> boundStudentIds = bindingRepository.findByTerminalSerial(serial).stream()
            .map(TerminalUserBinding::getStudentId)
            .collect(Collectors.toSet());
        return buildUnboundList(boundStudentIds);
    }

    /** Shared body — takes the "already bound" studentId set (however it
     *  was computed) and returns the sorted UnboundStudentDto list. */
    private List<UnboundStudentDto> buildUnboundList(java.util.Set<String> boundStudentIds) {
        List<Student> allStudents = studentRepository.findByDeletedAtIsNull();
        List<Student> unbound = allStudents.stream()
            .filter(s -> !boundStudentIds.contains(s.getStudentId()))
            .toList();
        if (unbound.isEmpty()) return List.of();

        // Batch-load classes so the dto can carry class + section names
        // instead of raw ids — mirrors what listBindings does.
        List<String> classIds = unbound.stream()
            .map(Student::getClassId)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .toList();
        Map<String, SchoolClass> classById = schoolClassRepository.findAllById(classIds).stream()
            .collect(Collectors.toMap(SchoolClass::getClassId, c -> c, (a, b) -> a));

        return unbound.stream()
            .map(s -> {
                UnboundStudentDto dto = new UnboundStudentDto();
                dto.setStudentId(s.getStudentId());
                dto.setName(displayName(s));
                dto.setRollNumber(s.getRollNumber());
                dto.setAdmissionNumber(s.getAdmissionNumber());
                SchoolClass cls = s.getClassId() == null ? null : classById.get(s.getClassId());
                if (cls != null) {
                    dto.setClassName(cls.getName());
                    if (cls.getSections() != null && s.getSectionId() != null) {
                        cls.getSections().stream()
                            .filter(sec -> s.getSectionId().equals(sec.getSectionId()))
                            .findFirst()
                            .ifPresent(sec -> dto.setSectionName(sec.getName()));
                    }
                }
                return dto;
            })
            // Sort so the dialog reads naturally: 1st-A rolls in order,
            // then 1st-B, etc. Nulls sink to the bottom.
            .sorted(java.util.Comparator
                .comparing(UnboundStudentDto::getClassName,
                    java.util.Comparator.nullsLast(String::compareTo))
                .thenComparing(UnboundStudentDto::getSectionName,
                    java.util.Comparator.nullsLast(String::compareTo))
                .thenComparing(UnboundStudentDto::getRollNumber,
                    java.util.Comparator.nullsLast((a, b) ->
                        a.compareTo(b) == 0 ? 0 :
                        a.matches("\\d+") && b.matches("\\d+")
                            ? Integer.compare(Integer.parseInt(a), Integer.parseInt(b))
                            : a.compareTo(b)))
                .thenComparing(UnboundStudentDto::getName,
                    java.util.Comparator.nullsLast(String::compareTo)))
            .toList();
    }

    // ── Helpers ──────────────────────────────────────────────────

    private String normaliseSerial(String raw) {
        return raw == null ? null : raw.trim().toUpperCase();
    }

    private ScannerTerminal requireTerminal(String serial) {
        return terminalRepository.findByTerminalSerial(serial)
            .orElseThrow(() -> new ResourceNotFoundException("ScannerTerminal", serial));
    }

    private TerminalResponse toResponse(ScannerTerminal t, long bindingCount) {
        return new TerminalResponse(
            t.getTerminalSerial(), t.getLabel(), t.getLastSeenAt(), bindingCount, t.getCreatedAt());
    }

    private TerminalBindingResponse toBindingResponse(TerminalUserBinding b, Student s,
                                                        Map<String, ClassSectionLabel> classLabels) {
        TerminalBindingResponse dto = new TerminalBindingResponse();
        dto.setTerminalUserId(b.getTerminalUserId());
        dto.setStudentId(s.getStudentId());
        dto.setStudentName(displayName(s));
        dto.setRollNumber(s.getRollNumber());
        ClassSectionLabel label = classLabels.get(s.getClassId());
        if (label != null) {
            dto.setClassName(label.className);
            dto.setSectionName(label.sectionsById.get(s.getSectionId()));
        }
        dto.setBoundAt(b.getBoundAt());
        dto.setBoundBy(b.getBoundBy());
        return dto;
    }

    /** Batch-fetch every SchoolClass referenced by the given bindings so
     *  the bindings-list response doesn't do N + 1 lookups. */
    private Map<String, ClassSectionLabel> classIndex(List<TerminalUserBinding> bindings) {
        List<String> studentIds = bindings.stream().map(TerminalUserBinding::getStudentId).distinct().toList();
        if (studentIds.isEmpty()) return Map.of();
        List<Student> students = studentRepository.findByStudentIdInAndDeletedAtIsNull(studentIds);
        List<String> classIds = students.stream()
            .map(Student::getClassId).filter(java.util.Objects::nonNull).distinct().toList();
        if (classIds.isEmpty()) return Map.of();
        List<SchoolClass> classes = schoolClassRepository.findAllById(classIds);
        Map<String, ClassSectionLabel> out = new java.util.HashMap<>();
        for (SchoolClass c : classes) {
            ClassSectionLabel label = new ClassSectionLabel();
            label.className = c.getName();
            if (c.getSections() != null) {
                for (SchoolClass.Section sec : c.getSections()) {
                    label.sectionsById.put(sec.getSectionId(), sec.getName());
                }
            }
            out.put(c.getClassId(), label);
        }
        return out;
    }

    private String displayName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last = s.getLastName() == null ? "" : s.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (s.getAdmissionNumber() != null) return "Adm " + s.getAdmissionNumber();
        return s.getStudentId();
    }

    private static class ClassSectionLabel {
        String className;
        Map<String, String> sectionsById = new java.util.HashMap<>();
    }
}
