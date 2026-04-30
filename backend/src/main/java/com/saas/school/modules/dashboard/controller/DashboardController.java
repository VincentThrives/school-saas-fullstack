package com.saas.school.modules.dashboard.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.dashboard.dto.ClassFeeSummary;
import com.saas.school.modules.dashboard.dto.DashboardDto;
import com.saas.school.modules.fee.model.FeeStructure;
import com.saas.school.modules.fee.model.StudentFeeLedger;
import com.saas.school.modules.fee.repository.FeeStructureRepository;
import com.saas.school.modules.fee.repository.StudentFeeLedgerRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Tag(name="Dashboard")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    @Autowired private StudentRepository studentRepo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SchoolClassRepository classRepo;
    @Autowired private AttendanceRepository attendanceRepo;
    @Autowired private AcademicYearRepository academicYearRepo;
    @Autowired private StudentFeeLedgerRepository feeLedgerRepo;
    @Autowired private FeeStructureRepository feeStructureRepo;

    /**
     * Dashboard stats. If {@code academicYearId} is passed, counts are scoped
     * to that year. When omitted, the backend defaults to the current year
     * so the admin dashboard always reflects the active session.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard(
            @RequestParam(required = false) String academicYearId) {
        // Resolve effective academic year: request > current > none
        String effectiveYearId = academicYearId;
        if (effectiveYearId == null || effectiveYearId.isBlank()) {
            effectiveYearId = academicYearRepo.findByIsCurrent(true)
                    .map(AcademicYear::getAcademicYearId)
                    .orElse(null);
        }

        DashboardDto dto = new DashboardDto();

        if (effectiveYearId == null) {
            // No academic year configured yet — fall back to global counts.
            dto.setTotalStudents(studentRepo.countByDeletedAtIsNull());
            dto.setTotalTeachers(teacherRepo.countByDeletedAtIsNull());
            dto.setTotalUsers(userRepo.count());
            dto.setTotalClasses(classRepo.count());
            dto.setAttendanceTodayPercent(computeTodaysAttendancePercent());
            dto.setPendingFeesStudents(0L);
            dto.setPendingFeesAmount(0.0);
            return ResponseEntity.ok(ApiResponse.success(dto));
        }

        // ── Year-scoped counts ──────────────────────────────────────────
        dto.setTotalStudents(countStudentsForYear(effectiveYearId));
        dto.setTotalClasses(countClassesForYear(effectiveYearId));
        // Teachers and users are not year-scoped in the data model; keep global soft-delete-respecting counts.
        dto.setTotalTeachers(teacherRepo.countByDeletedAtIsNull());
        dto.setTotalUsers(userRepo.count());
        dto.setAttendanceTodayPercent(computeTodaysAttendancePercent());

        // ── Pending Fees (year-scoped) ──────────────────────────────────
        // Aggregate from the per-class summary so the totals match what's
        // shown in the breakdown table — including students who have no ledger
        // row yet (their full fee structure amount counts as pending).
        List<ClassFeeSummary> rows = computeFeesByClass(effectiveYearId);
        long pendingStudents = 0;
        double pendingAmount = 0.0;
        for (ClassFeeSummary r : rows) {
            pendingStudents += r.getPendingStudents();
            pendingAmount += r.getTotalPending();
        }
        dto.setPendingFeesStudents(pendingStudents);
        // Round to 2 decimals so the UI doesn't render long floating-point tails.
        dto.setPendingFeesAmount(Math.round(pendingAmount * 100.0) / 100.0);

        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    /**
     * Class-wise fee breakdown for the dashboard's "Pending Fees" card.
     * Returns one row per class for the active year. When a student has no
     * ledger yet, we treat the full fee structure as their balance — so the
     * card shows real amounts even before any payments are recorded.
     */
    @GetMapping("/fees-by-class")
    public ResponseEntity<ApiResponse<List<ClassFeeSummary>>> getFeesByClass(
            @RequestParam(required = false) String academicYearId) {
        String effectiveYearId = academicYearId;
        if (effectiveYearId == null || effectiveYearId.isBlank()) {
            effectiveYearId = academicYearRepo.findByIsCurrent(true)
                    .map(AcademicYear::getAcademicYearId)
                    .orElse(null);
        }
        if (effectiveYearId == null) {
            return ResponseEntity.ok(ApiResponse.success(new ArrayList<>()));
        }
        return ResponseEntity.ok(ApiResponse.success(computeFeesByClass(effectiveYearId)));
    }

    /**
     * Core aggregation. Pulls the roster (year-scoped students), the fee
     * structures, and the existing ledgers, then per class:
     *   totalDue  = sum( ledger.totalDue if exists, else perStudentFee )
     *   totalPaid = sum( ledger.totalPaid )
     *   pending   = max(0, totalDue - totalPaid)
     */
    private List<ClassFeeSummary> computeFeesByClass(String academicYearId) {
        // ── Source 1: ledgers for the year (authoritative for paid amounts).
        // We DON'T anchor on classRepo.findByAcademicYearId because in some
        // tenants the classes collection isn't year-tagged consistently — that
        // would yield an empty dashboard even when the Fees page clearly shows
        // ledgers exist. Drive aggregation off the data that exists.
        List<StudentFeeLedger> ledgers = feeLedgerRepo.findByAcademicYearId(academicYearId);
        Map<String, StudentFeeLedger> ledgerByStudent = new HashMap<>();
        for (StudentFeeLedger l : ledgers) {
            if (l.getStudentId() != null) ledgerByStudent.put(l.getStudentId(), l);
        }

        // ── Source 2: fee structures → per-student fee per class (for students
        //               who don't have a ledger yet).
        Map<String, Double> perStudentFeeByClass = new HashMap<>();
        for (FeeStructure fs : feeStructureRepo.findByAcademicYearId(academicYearId)) {
            if (fs.getClassId() == null) continue;
            perStudentFeeByClass.merge(fs.getClassId(), fs.getAmount(), Double::sum);
        }

        // ── Class-name lookup (best effort: classes collection + ledger snapshots).
        Map<String, String> classNameById = new HashMap<>();
        for (SchoolClass cls : classRepo.findAll()) {
            if (cls.getClassId() != null) classNameById.put(cls.getClassId(), cls.getName());
        }
        for (StudentFeeLedger l : ledgers) {
            if (l.getClassId() != null && l.getClassName() != null
                    && !classNameById.containsKey(l.getClassId())) {
                classNameById.put(l.getClassId(), l.getClassName());
            }
        }

        // ── Build per-class buckets driven by the actual rosters and ledgers.
        Map<String, ClassFeeSummary> byClass = new LinkedHashMap<>();
        Set<String> studentsCovered = new HashSet<>();

        // Pass 1: walk the year's roster.
        for (Student s : studentRepo.findByDeletedAtIsNull()) {
            if (!academicYearId.equals(s.getAcademicYearId())) continue;
            String cid = s.getClassId();
            if (cid == null) continue;
            ClassFeeSummary row = byClass.computeIfAbsent(cid, k -> mkRow(k, classNameById));

            StudentFeeLedger l = ledgerByStudent.get(s.getStudentId());
            double studentDue;
            double studentPaid;
            if (l != null) {
                studentDue = l.getTotalDue();
                studentPaid = l.getTotalPaid();
            } else {
                studentDue = perStudentFeeByClass.getOrDefault(cid, 0.0);
                studentPaid = 0.0;
            }
            row.setStudentCount(row.getStudentCount() + 1);
            row.setTotalDue(row.getTotalDue() + studentDue);
            row.setTotalPaid(row.getTotalPaid() + studentPaid);
            if (studentDue - studentPaid > 0.0001) {
                row.setPendingStudents(row.getPendingStudents() + 1);
            }
            if (s.getStudentId() != null) studentsCovered.add(s.getStudentId());
        }

        // Pass 2: pick up ledgers whose student isn't in the roster (e.g.
        // transferred students, or students whose Student.academicYearId
        // wasn't migrated to the new year). We still want their numbers
        // visible on the dashboard since the Fees page already shows them.
        for (StudentFeeLedger l : ledgers) {
            if (l.getStudentId() != null && studentsCovered.contains(l.getStudentId())) continue;
            String cid = l.getClassId() != null ? l.getClassId() : "__unassigned__";
            ClassFeeSummary row = byClass.computeIfAbsent(cid, k -> mkRow(k, classNameById));
            row.setStudentCount(row.getStudentCount() + 1);
            row.setTotalDue(row.getTotalDue() + l.getTotalDue());
            row.setTotalPaid(row.getTotalPaid() + l.getTotalPaid());
            if (l.getBalance() > 0.0001) {
                row.setPendingStudents(row.getPendingStudents() + 1);
            }
        }

        // Finalize: pending = max(0, due - paid), round, sort.
        List<ClassFeeSummary> out = new ArrayList<>(byClass.values());
        for (ClassFeeSummary r : out) {
            double pending = Math.max(0.0, r.getTotalDue() - r.getTotalPaid());
            r.setTotalDue(round2(r.getTotalDue()));
            r.setTotalPaid(round2(r.getTotalPaid()));
            r.setTotalPending(round2(pending));
        }
        out.sort((a, b) -> {
            String an = a.getClassName() == null ? "" : a.getClassName();
            String bn = b.getClassName() == null ? "" : b.getClassName();
            return an.compareToIgnoreCase(bn);
        });
        return out;
    }

    /** Build an empty per-class summary row, resolving the best-known class name. */
    private ClassFeeSummary mkRow(String classId, Map<String, String> classNameById) {
        ClassFeeSummary r = new ClassFeeSummary();
        r.setClassId(classId);
        String name = classNameById.get(classId);
        if (name == null || name.isBlank()) {
            name = "__unassigned__".equals(classId) ? "Unassigned" : "Class";
        }
        r.setClassName(name);
        return r;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private long countStudentsForYear(String academicYearId) {
        // StudentRepository exposes a Page finder by academicYearId + soft-delete
        // filter. We use findByDeletedAtIsNull + in-memory filter here because
        // there's no direct count() variant. Volumes are small (hundreds per tenant).
        List<Student> all = studentRepo.findByDeletedAtIsNull();
        long n = 0;
        for (Student s : all) {
            if (academicYearId.equals(s.getAcademicYearId())) n++;
        }
        return n;
    }

    private long countClassesForYear(String academicYearId) {
        List<SchoolClass> rows = classRepo.findByAcademicYearId(academicYearId);
        return rows == null ? 0 : rows.size();
    }

    /**
     * Today's attendance rate across the whole tenant.
     * Denominator = total attendance records entered for today.
     * Numerator   = records with status PRESENT or LATE (late still counts as present).
     * Returns 0.0 when no attendance has been marked yet today.
     */
    private Double computeTodaysAttendancePercent() {
        LocalDate today = LocalDate.now();
        long total = attendanceRepo.countByDate(today);
        if (total == 0) return 0.0;
        long present = attendanceRepo.countByDateAndStatus(today, Attendance.Status.PRESENT)
                     + attendanceRepo.countByDateAndStatus(today, Attendance.Status.LATE);
        double pct = (present * 100.0) / total;
        return Math.round(pct * 10.0) / 10.0; // one decimal place
    }
}
