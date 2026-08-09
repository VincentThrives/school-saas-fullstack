package com.saas.school.modules.biometricterminal.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometricterminal.dto.BindUserRequest;
import com.saas.school.modules.biometricterminal.dto.RegisterTerminalRequest;
import com.saas.school.modules.biometricterminal.dto.TerminalBindingResponse;
import com.saas.school.modules.biometricterminal.dto.TerminalResponse;
import com.saas.school.modules.biometricterminal.dto.UpdateTerminalRequest;
import com.saas.school.modules.biometricterminal.model.ScannerTerminal;
import com.saas.school.modules.biometricterminal.model.TerminalUserBinding;
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
        return terminals.stream()
            .map(t -> toResponse(t, bindingRepository.countByTerminalSerial(t.getTerminalSerial())))
            .toList();
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

        TerminalUserBinding binding = bindingRepository
            .findByTerminalSerialAndTerminalUserId(serial, req.getTerminalUserId())
            .orElseGet(() -> {
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

    /** Backdoor for the ADMS controller — same lookup path but no admin
     *  precondition (the "does this terminal exist" check happens in the
     *  controller against a different code path). */
    public Optional<TerminalUserBinding> resolveBinding(String serial, String terminalUserId) {
        return bindingRepository.findByTerminalSerialAndTerminalUserId(serial, terminalUserId);
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
