package com.saas.school.modules.hr.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometricterminal.model.ScannerTerminal;
import com.saas.school.modules.biometricterminal.model.TerminalUserBinding;
import com.saas.school.modules.biometricterminal.repository.ScannerTerminalRepository;
import com.saas.school.modules.biometricterminal.repository.TerminalUserBindingRepository;
import com.saas.school.modules.hr.dto.HrBindingUpsertRequest;
import com.saas.school.modules.hr.dto.HrEmployeeTerminalBindingDto;
import com.saas.school.modules.hr.dto.HrTerminalDto;
import com.saas.school.modules.hr.dto.HrTerminalPunchDto;
import com.saas.school.modules.hr.dto.HrUnboundEmployeeDto;
import com.saas.school.modules.hr.model.EmployeeAttendance;
import com.saas.school.modules.hr.model.EmployeeTerminalBinding;
import com.saas.school.modules.hr.repository.EmployeeAttendanceRepository;
import com.saas.school.modules.hr.repository.EmployeeTerminalBindingRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * HR-only CRUD for {@link EmployeeTerminalBinding}. Mirrors the shape
 * of the student-side {@code TerminalRegistrationService} but scoped
 * to Teachers / staff.
 *
 * <p>Reads {@link ScannerTerminal} through its existing repository —
 * HR doesn't own terminals (admin does), but does need to list them
 * so bindings can be attached to the right device.</p>
 */
@Service
public class HrTerminalBindingService {

    private static final Logger log = LoggerFactory.getLogger(HrTerminalBindingService.class);

    @Autowired private EmployeeTerminalBindingRepository bindingRepo;
    @Autowired private ScannerTerminalRepository terminalRepo;
    @Autowired private TeacherRepository teacherRepo;
    /** Read-only reference to the student-side bindings collection so
     *  we can reject a cross-collection PIN collision. HR never
     *  mutates this — only checks it. */
    @Autowired private TerminalUserBindingRepository studentBindingRepo;
    /** Used only to enrich a cross-collection collision error with the
     *  colliding student's name, so HR knows exactly whose enrolment
     *  to clean up on the admin side. */
    @Autowired private StudentRepository studentRepo;
    /** Read-only — used by the "Punches on this terminal" panel to
     *  fetch each bound employee's IN/OUT row for the chosen date. */
    @Autowired private EmployeeAttendanceRepository attendanceRepo;

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    // ── Terminal listing ────────────────────────────────────────

    /** All terminals registered against this tenant, each annotated
     *  with the count of employee bindings on it. Small enough to
     *  render inline in the HR page's dropdown without pagination
     *  (schools rarely have more than a handful of devices). */
    public List<HrTerminalDto> listTerminals() {
        List<ScannerTerminal> terminals = terminalRepo.findAllByOrderByCreatedAtDesc();
        if (terminals.isEmpty()) return List.of();
        return terminals.stream()
            .map(t -> new HrTerminalDto(
                t.getTerminalSerial(),
                t.getLabel(),
                t.getLastSeenAt(),
                bindingRepo.countByTerminalSerial(t.getTerminalSerial())))
            .toList();
    }

    // ── Bindings CRUD ───────────────────────────────────────────

    /** Bindings on one terminal, enriched with employee names +
     *  designation so the UI doesn't need a second round-trip. */
    public List<HrEmployeeTerminalBindingDto> listBindings(String serial) {
        requireTerminal(serial);
        List<EmployeeTerminalBinding> bindings = bindingRepo.findByTerminalSerial(serial);
        if (bindings.isEmpty()) return List.of();
        Map<String, Teacher> byId = loadTeachers(bindings.stream()
                .map(EmployeeTerminalBinding::getEmployeeId)
                .filter(Objects::nonNull).distinct().toList());
        List<HrEmployeeTerminalBindingDto> out = new ArrayList<>(bindings.size());
        for (EmployeeTerminalBinding b : bindings) {
            Teacher t = byId.get(b.getEmployeeId());
            out.add(toDto(b, t));
        }
        // Newest bindings on top — matches the student-side ordering
        // and gives HR an activity-log feel.
        out.sort(Comparator.comparing(
            HrEmployeeTerminalBindingDto::getBoundAt,
            Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    public HrEmployeeTerminalBindingDto createBinding(String serial,
                                                       HrBindingUpsertRequest req,
                                                       String adminUserId) {
        requireTerminal(serial);
        if (req == null) throw new BusinessException("Binding payload is required.");
        String uid = trimmedOrNull(req.getTerminalUserId());
        if (uid == null) throw new BusinessException("Terminal user id is required.");
        String employeeId = trimmedOrNull(req.getEmployeeId());
        if (employeeId == null) throw new BusinessException("Employee id is required.");

        Teacher employee = teacherRepo.findByTeacherIdAndDeletedAtIsNull(employeeId)
            .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));

        // Cross-collection clash: same PIN already bound to a student
        // on this terminal. ADMS would then route the punch to the
        // employee and silently drop the student's attendance — bad
        // failure mode, block it here with a clear message so admin
        // knows which student binding to remove first.
        checkStudentBindingClash(serial, uid);

        // Reject clashing terminal user id — a slot on the terminal
        // maps to a single physical finger, so re-mapping it would
        // silently swap enrolments.
        Optional<EmployeeTerminalBinding> clash =
            bindingRepo.findByTerminalSerialAndTerminalUserId(serial, uid);
        if (clash.isPresent() && !employee.getTeacherId().equals(clash.get().getEmployeeId())) {
            String other = teacherRepo.findByTeacherIdAndDeletedAtIsNull(clash.get().getEmployeeId())
                .map(HrTerminalBindingService::displayName).orElse("another employee");
            throw new BusinessException("Terminal user id '" + uid
                + "' is already bound to " + other
                + ". Remove that binding first, or use a different id.");
        }

        EmployeeTerminalBinding row = clash.orElseGet(() -> {
            EmployeeTerminalBinding fresh = new EmployeeTerminalBinding();
            fresh.setId(UUID.randomUUID().toString());
            fresh.setTenantId(TenantContext.getTenantId());
            fresh.setTerminalSerial(serial);
            fresh.setTerminalUserId(uid);
            return fresh;
        });
        row.setEmployeeId(employee.getTeacherId());
        row.setBoundBy(adminUserId);
        row.setBoundAt(Instant.now());
        EmployeeTerminalBinding saved = bindingRepo.save(row);
        log.info("HR binding upserted: employee={} serial={} uid={} by={}",
            employee.getTeacherId(), serial, uid, adminUserId);
        return toDto(saved, employee);
    }

    /** Change the terminal user id on an existing binding — common
     *  case is a re-enrolment on the device that produced a new slot
     *  number. Rejects when the new id clashes with another binding
     *  on the same terminal. */
    public HrEmployeeTerminalBindingDto updateBinding(String serial,
                                                       String currentTerminalUserId,
                                                       HrBindingUpsertRequest req,
                                                       String adminUserId) {
        requireTerminal(serial);
        if (req == null) throw new BusinessException("Update payload is required.");
        String newUid = trimmedOrNull(req.getTerminalUserId());
        if (newUid == null) throw new BusinessException("New terminal user id is required.");

        EmployeeTerminalBinding binding = bindingRepo
            .findByTerminalSerialAndTerminalUserId(serial, currentTerminalUserId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "EmployeeTerminalBinding", serial + "/" + currentTerminalUserId));

        if (newUid.equals(binding.getTerminalUserId())) {
            Teacher t = teacherRepo.findByTeacherIdAndDeletedAtIsNull(binding.getEmployeeId()).orElse(null);
            return toDto(binding, t);
        }

        Optional<EmployeeTerminalBinding> clash =
            bindingRepo.findByTerminalSerialAndTerminalUserId(serial, newUid);
        if (clash.isPresent()) {
            throw new BusinessException("Terminal user id '" + newUid
                + "' is already bound to another employee on this terminal.");
        }
        // Same cross-collection check as create — a student may
        // already own the new PIN on this terminal.
        checkStudentBindingClash(serial, newUid);

        binding.setTerminalUserId(newUid);
        binding.setBoundBy(adminUserId);
        binding.setBoundAt(Instant.now());
        EmployeeTerminalBinding saved = bindingRepo.save(binding);
        Teacher t = teacherRepo.findByTeacherIdAndDeletedAtIsNull(saved.getEmployeeId()).orElse(null);
        return toDto(saved, t);
    }

    public void deleteBinding(String serial, String terminalUserId) {
        requireTerminal(serial);
        bindingRepo.findByTerminalSerialAndTerminalUserId(serial, terminalUserId)
            .ifPresent(bindingRepo::delete);
    }

    // ── Punches on this terminal (HR-only view) ────────────────

    /**
     * Punches on the given terminal for the given date, one row per
     * bound employee who has an {@link EmployeeAttendance} row.
     *
     * <p>Scoping is by binding, not by scan source — the employee's
     * daily row doesn't remember which terminal produced it (the
     * biometric write path only stamps {@code source=BIOMETRIC} +
     * an {@code adms:SERIAL/uid} tag on {@code markedByUserId}). We
     * additionally filter to {@code BIOMETRIC} source so a manual
     * or location mark on the same day doesn't show up here — HR
     * only wants terminal activity in this panel.</p>
     *
     * <p>Missing / null date defaults to today in the tenant zone
     * so the endpoint is safe to hit without a query param.</p>
     */
    public List<HrTerminalPunchDto> getTerminalPunches(String serial, LocalDate date) {
        requireTerminal(serial);
        LocalDate day = date == null ? LocalDate.now(ZONE) : date;

        List<EmployeeTerminalBinding> bindings = bindingRepo.findByTerminalSerial(serial);
        if (bindings.isEmpty()) return List.of();

        // Employees we care about: those bound to this specific
        // terminal. Cross-terminal punches (rare — an employee bound
        // to two devices) are naturally excluded because the row's
        // source-terminal tag won't match this serial.
        Map<String, EmployeeTerminalBinding> byEmployee = bindings.stream()
            .filter(b -> b.getEmployeeId() != null)
            .collect(Collectors.toMap(
                EmployeeTerminalBinding::getEmployeeId, b -> b, (a, b) -> a));
        List<String> employeeIds = new ArrayList<>(byEmployee.keySet());

        List<EmployeeAttendance> rows = attendanceRepo
            .findByDateAndEmployeeIdIn(day, employeeIds);
        if (rows.isEmpty()) return List.of();

        Map<String, Teacher> teachers = loadTeachers(employeeIds);
        String serialTag = "adms:" + serial + "/";

        List<HrTerminalPunchDto> out = new ArrayList<>();
        for (EmployeeAttendance row : rows) {
            // Skip non-biometric marks (location self-mark, HR
            // manual entry) — this panel is scoped to activity on
            // the picked terminal. A biometric-source row whose
            // {@code markedByUserId} was stamped by a different
            // terminal is also excluded so the panel is truthful.
            if (!"BIOMETRIC".equalsIgnoreCase(row.getSource())) continue;
            String mby = row.getMarkedByUserId();
            if (mby != null && mby.startsWith("adms:") && !mby.startsWith(serialTag)) continue;

            HrTerminalPunchDto dto = new HrTerminalPunchDto();
            dto.setEmployeeId(row.getEmployeeId());
            Teacher t = teachers.get(row.getEmployeeId());
            dto.setEmployeeName(t != null ? displayName(t) : "(deleted employee)");
            dto.setDesignation(t != null ? t.getEmployeeRole() : null);
            EmployeeTerminalBinding b = byEmployee.get(row.getEmployeeId());
            dto.setTerminalUserId(b == null ? null : b.getTerminalUserId());
            dto.setStatus(row.getStatus());
            dto.setLate(row.isLate());
            dto.setInTime(row.getInTime());
            dto.setOutTime(row.getOutTime());
            out.add(dto);
        }
        // Order by IN time descending (freshest at the top) — matches
        // the mental model of "who just walked in".
        out.sort(Comparator.comparing(
            HrTerminalPunchDto::getInTime,
            Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    // ── ADMS-side resolver ──────────────────────────────────────

    /** Called by {@code AdmsPushController} before it falls back to
     *  the student binding. Present-with-employee wins the routing;
     *  absent means "not an employee, try students". */
    public Optional<EmployeeTerminalBinding> resolveEmployeeBinding(String serial, String terminalUserId) {
        return bindingRepo.findByTerminalSerialAndTerminalUserId(serial, terminalUserId);
    }

    // ── Unbound employee list (for the "add" dropdown) ──────────

    /** Employees who aren't bound to ANY terminal — safer than
     *  per-terminal filtering because HR usually only wants the same
     *  person enrolled on one device (the one at the entrance). */
    public List<HrUnboundEmployeeDto> getUnboundEmployees() {
        java.util.Set<String> bound = bindingRepo.findAll().stream()
            .map(EmployeeTerminalBinding::getEmployeeId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        // Cap page size high enough for any real school — the endpoint
        // is only ever hit in an admin dropdown, not in a hot loop.
        List<Teacher> all = teacherRepo.findByDeletedAtIsNull(Pageable.unpaged()).getContent();
        return all.stream()
            .filter(t -> !bound.contains(t.getTeacherId()))
            .sorted(Comparator.comparing(
                HrTerminalBindingService::displayName,
                Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(t -> new HrUnboundEmployeeDto(
                t.getTeacherId(),
                displayName(t),
                t.getEmployeeRole()))
            .toList();
    }

    // ── Helpers ─────────────────────────────────────────────────

    /**
     * Reject if the given (terminal, PIN) is already claimed by a
     * student on the admin-side bindings table. Because the ADMS
     * resolver prefers employee bindings, letting HR create a
     * colliding row would silently divert the student's punches to
     * an employee — a data-corruption failure mode. Error names the
     * student so the HR admin can go clear the correct enrolment.
     */
    private void checkStudentBindingClash(String serial, String uid) {
        Optional<TerminalUserBinding> studentClash =
            studentBindingRepo.findByTerminalSerialAndTerminalUserId(serial, uid);
        if (studentClash.isEmpty()) return;
        String studentName = studentRepo
            .findByStudentIdAndDeletedAtIsNull(studentClash.get().getStudentId())
            .map(HrTerminalBindingService::displayStudentName)
            .orElse("a student");
        throw new BusinessException("Terminal user id '" + uid
            + "' is already bound to " + studentName + " (student). "
            + "Ask your admin to remove that binding from the "
            + "Biometric Terminals page before enrolling this employee.");
    }

    private ScannerTerminal requireTerminal(String serial) {
        String s = normaliseSerial(serial);
        return terminalRepo.findByTerminalSerial(s)
            .orElseThrow(() -> new ResourceNotFoundException("ScannerTerminal", s));
    }

    private Map<String, Teacher> loadTeachers(List<String> ids) {
        if (ids.isEmpty()) return Map.of();
        return teacherRepo.findAllById(ids).stream()
            .filter(t -> t.getDeletedAt() == null)
            .collect(Collectors.toMap(Teacher::getTeacherId, t -> t, (a, b) -> a));
    }

    private HrEmployeeTerminalBindingDto toDto(EmployeeTerminalBinding b, Teacher t) {
        HrEmployeeTerminalBindingDto dto = new HrEmployeeTerminalBindingDto();
        dto.setBindingId(b.getId());
        dto.setTerminalSerial(b.getTerminalSerial());
        dto.setTerminalUserId(b.getTerminalUserId());
        dto.setEmployeeId(b.getEmployeeId());
        if (t != null) {
            dto.setEmployeeName(displayName(t));
            dto.setDesignation(t.getEmployeeRole());
        } else {
            // Soft-deleted employee — keep the row visible so HR can
            // clean the binding up manually.
            dto.setEmployeeName("(deleted employee)");
        }
        dto.setBoundBy(b.getBoundBy());
        dto.setBoundAt(b.getBoundAt());
        return dto;
    }

    private static String displayName(Teacher t) {
        String first = t.getFirstName() == null ? "" : t.getFirstName().trim();
        String last = t.getLastName() == null ? "" : t.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (t.getEmployeeId() != null) return "Emp " + t.getEmployeeId();
        return t.getTeacherId();
    }

    /** Same shape as {@link #displayName(Teacher)} but for the
     *  student side — used only by the cross-collection collision
     *  error message so it can name the actual kid. */
    private static String displayStudentName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last = s.getLastName() == null ? "" : s.getLastName().trim();
        String full = (first + " " + last).trim();
        if (!full.isEmpty()) return full;
        if (s.getAdmissionNumber() != null) return "Adm " + s.getAdmissionNumber();
        return s.getStudentId();
    }

    private static String normaliseSerial(String raw) {
        return raw == null ? null : raw.trim().toUpperCase();
    }

    private static String trimmedOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
