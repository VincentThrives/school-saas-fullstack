package com.saas.school.modules.attendance.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationRuleEngine;
import com.saas.school.modules.notification.service.NotificationRuleEngine.FirePayload;
import com.saas.school.modules.sms.model.SmsTrigger;
import com.saas.school.modules.sms.service.SmsService;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.repository.TeacherSubjectAssignmentRepository;
import com.saas.school.modules.timetable.model.Timetable;
import com.saas.school.modules.timetable.repository.TimetableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    @Autowired private StudentsAttendanceRepository batchRepository;
    @Autowired private TimetableRepository timetableRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private TeacherSubjectAssignmentRepository assignmentRepository;
    @Autowired private SchoolEventRepository eventRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private NotificationRuleEngine ruleEngine;
    @Autowired private SmsService smsService;
    @Autowired private AuditService auditService;

    // ── Component-key resolution ────────────────────────────────────

    /**
     * Pick the componentKey for an attendance request, validating the
     * caller's input against the subject's component list.
     *
     * <p>Rules:
     * <ul>
     *   <li>No {@code subjectId} on the request (day-wise marking) → return null.</li>
     *   <li>Subject has one component → ignore caller's componentKey;
     *       auto-fill from the only component. Keeps older clients
     *       working unchanged.</li>
     *   <li>Subject has multiple components → caller MUST send a
     *       componentKey matching one of them, AND that component must
     *       have {@code trackAttendance=true}. INTERNAL-mode
     *       components are silently allowed if their
     *       trackAttendance is true (rare but possible).</li>
     * </ul>
     */
    private String resolveComponentKeyForAttendance(MarkAttendanceRequest req) {
        if (req.getSubjectId() == null || req.getSubjectId().isBlank()) {
            return null;
        }
        Subject subject = subjectRepository.findById(req.getSubjectId()).orElse(null);
        if (subject == null || subject.getComponents() == null || subject.getComponents().isEmpty()) {
            // Subject in old shape (no components) or unknown — fall back to
            // whatever the caller sent rather than blocking. Lets the rest of
            // the system surface the real "subject not found" error.
            return req.getComponentKey();
        }

        // ── Caller supplied a componentKey — validate it and use it.
        if (req.getComponentKey() != null && !req.getComponentKey().isBlank()) {
            Subject.Component target = subject.componentByKey(req.getComponentKey());
            if (target == null) {
                throw new IllegalArgumentException(
                        "Component '" + req.getComponentKey() + "' not found on subject '"
                                + subject.getName() + "'.");
            }
            if (!target.isTrackAttendance()) {
                throw new IllegalArgumentException(
                        "Component '" + target.getLabel() + "' is not attendance-tracked.");
            }
            return target.getKey();
        }

        // ── No componentKey supplied — auto-pick from attendance-tracked components.
        // Math example: Theory (trackAttendance=true) + IA (trackAttendance=false).
        // The teacher takes attendance for "Mathematics" → Theory is the only
        // component that tracks attendance, so we silently pick it. No need to
        // bother the UI with a component dropdown for the common case.
        List<Subject.Component> tracked = subject.getComponents().stream()
                .filter(c -> c != null && c.isTrackAttendance())
                .toList();

        if (tracked.isEmpty()) {
            throw new IllegalArgumentException(
                    "Subject '" + subject.getName() + "' has no attendance-tracked components. "
                            + "Configure at least one component with attendance tracking enabled.");
        }
        if (tracked.size() == 1) {
            // Most-common path. Auto-pick the only tracked component.
            return tracked.get(0).getKey();
        }
        // 2+ tracked components (e.g. Theory + Practical both track) — the
        // caller has to disambiguate. Surface the available labels so the
        // error message tells the admin which choices exist.
        String labels = tracked.stream()
                .map(Subject.Component::getLabel)
                .collect(java.util.stream.Collectors.joining(", "));
        throw new IllegalArgumentException(
                "Subject '" + subject.getName() + "' has multiple attendance-tracked components ("
                        + labels + "). Pick which one this attendance is for.");
    }

    // ── Batch attendance (1 document per class+section+date+period) ──

    public StudentsAttendance markBatchAttendance(MarkAttendanceRequest req, String markedBy) {
        // Block future dates
        if (req.getDate() != null && req.getDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Cannot mark attendance for a future date");
        }

        // Block holidays
        List<SchoolEvent> holidays = eventRepository.findByIsHolidayTrue();
        for (SchoolEvent h : holidays) {
            if (req.getDate() != null && h.getStartDate() != null && h.getEndDate() != null
                    && !req.getDate().isBefore(h.getStartDate()) && !req.getDate().isAfter(h.getEndDate())) {
                throw new IllegalArgumentException("Cannot mark attendance on holiday: " + h.getTitle());
            }
        }

        // ── Day-wise gate ────────────────────────────────────────────
        // Only the section's assigned class teacher (per the Teacher
        // Assignment module — TeacherSubjectAssignment with role
        // CLASS_TEACHER) may mark day-wise attendance. Admins /
        // principals fall through (no Teacher row under their userId,
        // so the lookup is empty → skip). Subject-wise marks
        // (req.subjectId set) keep the existing component-key path
        // with no extra gate.
        if (req.getSubjectId() == null || req.getSubjectId().isBlank()) {
            assertClassTeacherForDayWise(req, markedBy);
        }

        int period = req.getPeriodNumber();  // 0 for day-wise

        // Resolve the target component on the subject (if subjectId is given).
        // For a hybrid subject like PUC II Physics, the same date + period slot
        // can host two rows — one for Theory, one for Practical — distinguished
        // by componentKey. Auto-fill the key for single-component subjects so
        // older clients that don't send it keep working.
        String resolvedComponentKey = resolveComponentKeyForAttendance(req);
        // Pass-through the teaching-side sub-part (Physics / Chemistry /
        // Biology under an integrated Science course). The timetable
        // already routes it via Period.subPartKey, so the mark-attendance
        // page just forwards whatever the period carries.
        String subPartKey = req.getSubPartKey();
        if (subPartKey != null && subPartKey.isBlank()) subPartKey = null;

        // Upsert: find existing or create new — keyed on the full
        // (componentKey, subPartKey) tuple so a Physics row and a
        // Chemistry row for the same date + period coexist cleanly.
        Optional<StudentsAttendance> existing = batchRepository
                .findByClassIdAndSectionIdAndDateAndPeriodNumberAndComponentKeyAndSubPartKey(
                        req.getClassId(), req.getSectionId(), req.getDate(), period,
                        resolvedComponentKey, subPartKey);

        StudentsAttendance record;
        if (existing.isPresent()) {
            record = existing.get();
        } else {
            record = new StudentsAttendance();
            record.setId(UUID.randomUUID().toString());
            record.setClassId(req.getClassId());
            record.setSectionId(req.getSectionId());
            record.setAcademicYearId(req.getAcademicYearId());
            record.setDate(req.getDate());
            record.setPeriodNumber(period);
            record.setSubjectId(req.getSubjectId());
            record.setComponentKey(resolvedComponentKey);
            record.setSubPartKey(subPartKey);
            record.setTeacherId(req.getTeacherId());
        }

        // Build entries from request
        List<StudentsAttendance.StudentEntry> entries = new ArrayList<>();
        for (var e : req.getEntries()) {
            entries.add(new StudentsAttendance.StudentEntry(
                    e.getStudentId(),
                    e.getStatus() != null ? e.getStatus().name() : "PRESENT",
                    e.getRemarks()));
        }
        record.setEntries(entries);
        record.setMarkedBy(markedBy);

        batchRepository.save(record);
        auditService.log("MARK_ATTENDANCE", "StudentsAttendance", record.getId(),
                "Batch attendance: class=" + req.getClassId() + " date=" + req.getDate()
                        + " period=" + period + " students=" + entries.size());

        // Fire ABSENCE_ALERT for each absent student. Idempotent per (studentId, date).
        // Pass the whole record so the SMS body can include class + subject
        // context (var2 = class name, var3 = date + subject) rather than
        // placeholder text.
        fireAbsenceAlerts(record, req.getDate());
        return record;
    }

    private void fireAbsenceAlerts(StudentsAttendance batch, LocalDate date) {
        if (batch == null || batch.getEntries() == null || date == null) return;
        List<StudentsAttendance.StudentEntry> entries = batch.getEntries();
        String dateKey = date.toString();

        // Pre-resolve class + subject names ONCE per batch (not per student)
        // so we don't hammer Mongo for every absence in the same period.
        String classLabel = resolveClassLabel(batch.getClassId(), batch.getSectionId());
        String subjectLabel = resolveSubjectLabel(batch.getSubjectId());
        for (var e : entries) {
            if (!"ABSENT".equalsIgnoreCase(e.getStatus())) continue;
            Student stu = studentRepository.findByStudentIdAndDeletedAtIsNull(e.getStudentId()).orElse(null);
            if (stu == null) continue;
            List<String> recipients = new ArrayList<>();
            if (stu.getParentIds() != null) recipients.addAll(stu.getParentIds());
            if (stu.getUserId() != null) recipients.add(stu.getUserId());
            if (recipients.isEmpty()) continue;

            String name = stu.getFirstName() != null
                    ? (stu.getFirstName() + (stu.getLastName() != null ? " " + stu.getLastName() : ""))
                    : ("Student " + (stu.getAdmissionNumber() != null ? stu.getAdmissionNumber() : ""));

            // Two date strings on purpose: dateKey stays ISO (used by the
            // rule engine for idempotency dedupe — must be stable and
            // machine-readable), friendlyDate is what shows up in the
            // parent's notification body.
            String friendlyDate = date.format(DateTimeFormatter.ofPattern("dd MMM yyyy"));
            Map<String, Object> vars = new HashMap<>();
            vars.put("student", name);
            vars.put("date", friendlyDate);

            FirePayload payload = FirePayload.toIndividuals(recipients)
                    .entityId(e.getStudentId())
                    .dateKey(dateKey)
                    .type(Notification.NotificationType.ATTENDANCE)
                    .vars(vars)
                    .fallback("Absent today",
                            "Dear Parent, " + name + " was marked absent on " + friendlyDate + ".");
            ruleEngine.fire("ABSENCE_ALERT", payload);

            // SMS dispatch was intentionally REMOVED from this loop.
            //
            // Old behaviour: every attendance save fanned out SMS immediately.
            // A teacher saving 6 periods caused 6 SMS bursts; a parent of a
            // child absent in 3 periods got 3 SMSes the same day. Costly
            // and spammy.
            //
            // New behaviour: SMS is sent ONLY when the school admin clicks
            // "Send today's absence alerts" on the SMS Notifications page.
            // That endpoint (POST /api/v1/sms/send-absent-today) walks
            // today's absences, dedupes by student, idempotency-guards
            // via the audit log, and fires one SMS per parent for the day.
            //
            // FCM push above STILL fires immediately on save — push is
            // free, instant, and good UX for parents using the app.
            log.debug("Marked absent (no SMS — manual dispatch only): studentId={} class={} date={} subject={}",
                    e.getStudentId(), classLabel, friendlyDate, subjectLabel);
        }
    }

    // ── Timetable lookup for a specific date ──

    public List<Map<String, Object>> getTimetablePeriodsForDate(
            String classId, String sectionId, String academicYearId, LocalDate date) {
        Optional<Timetable> ttOpt = timetableRepository
                .findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId);
        if (ttOpt.isEmpty()) return Collections.emptyList();

        Timetable tt = ttOpt.get();
        String dayName = date.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);

        Timetable.DaySchedule daySchedule = null;
        if (tt.getSchedule() != null) {
            for (Timetable.DaySchedule ds : tt.getSchedule()) {
                if (dayName.equalsIgnoreCase(ds.getDayOfWeek())) {
                    daySchedule = ds;
                    break;
                }
            }
        }
        if (daySchedule == null || daySchedule.getPeriods() == null) return Collections.emptyList();

        // Collect all subjectIds and teacherIds to resolve names in bulk
        Set<String> subjectIds = new HashSet<>();
        Set<String> teacherIds = new HashSet<>();
        for (Timetable.Period p : daySchedule.getPeriods()) {
            if (p.getSubjectId() != null) subjectIds.add(p.getSubjectId());
            if (p.getTeacherId() != null) teacherIds.add(p.getTeacherId());
        }

        // Build name maps from DB
        Map<String, String> subjectNameMap = new HashMap<>();
        if (!subjectIds.isEmpty()) {
            subjectRepository.findBySubjectIdIn(new ArrayList<>(subjectIds))
                    .forEach(s -> subjectNameMap.put(s.getSubjectId(), s.getName()));
        }
        Map<String, String> teacherNameMap = new HashMap<>();
        if (!teacherIds.isEmpty()) {
            for (String tid : teacherIds) {
                teacherRepository.findByTeacherIdAndDeletedAtIsNull(tid)
                        .ifPresent(t -> {
                            String name = (t.getFirstName() != null ? t.getFirstName() : "")
                                    + " " + (t.getLastName() != null ? t.getLastName() : "");
                            teacherNameMap.put(tid, name.trim().isEmpty() ? t.getEmployeeId() : name.trim());
                        });
            }
        }

        List<Map<String, Object>> periods = new ArrayList<>();
        for (Timetable.Period p : daySchedule.getPeriods()) {
            if (p.getSubjectId() == null || p.getSubjectId().isEmpty()) continue;
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("periodNumber", p.getPeriodNumber());
            pm.put("subjectId", p.getSubjectId());
            pm.put("subjectName", resolveSubjectName(p, subjectNameMap));
            pm.put("teacherId", p.getTeacherId());
            pm.put("teacherName", resolveTeacherName(p, teacherNameMap));
            pm.put("startTime", p.getStartTime());
            pm.put("endTime", p.getEndTime());
            // Hybrid-subject slice (Theory / Practical / IA) — drives the
            // "English (Theory)" suffix on attendance cards and the
            // auto-resolution at attendance-save time. Always present in
            // the response (possibly null) so the frontend can rely on it.
            pm.put("componentKey", p.getComponentKey());
            pm.put("componentLabel", p.getComponentLabel());

            Optional<StudentsAttendance> marked = batchRepository
                    .findByClassIdAndSectionIdAndDateAndPeriodNumber(classId, sectionId, date, p.getPeriodNumber());
            pm.put("marked", marked.isPresent());
            pm.put("studentCount", marked.map(m -> m.getEntries() != null ? m.getEntries().size() : 0).orElse(0));

            periods.add(pm);
        }
        return periods;
    }

    private String resolveSubjectName(Timetable.Period p, Map<String, String> nameMap) {
        if (p.getSubjectName() != null && !p.getSubjectName().isEmpty()) return p.getSubjectName();
        String fromDb = nameMap.get(p.getSubjectId());
        return fromDb != null ? fromDb : p.getSubjectId();
    }

    private String resolveTeacherName(Timetable.Period p, Map<String, String> nameMap) {
        if (p.getTeacherName() != null && !p.getTeacherName().isEmpty()) return p.getTeacherName();
        if (p.getTeacherId() == null || p.getTeacherId().isEmpty()) return "-";
        String fromDb = nameMap.get(p.getTeacherId());
        return fromDb != null ? fromDb : p.getTeacherId();
    }

    // ── Batch queries ──

    public List<StudentsAttendance> getBatchAttendance(String classId, String sectionId, LocalDate date) {
        return batchRepository.findByClassIdAndSectionIdAndDate(classId, sectionId, date);
    }

    /**
     * Roll up day-wise attendance status for every (class, section) the
     * school operates in the given academic year. One row per pair,
     * indicating whether attendance has been marked for {@code date} and,
     * when marked, the present / absent / other counts so the View
     * Attendance dashboard can render an at-a-glance card. Combines two
     * batched fetches (all classes in the year, all day-wise attendance
     * rows on the date) instead of N round-trips per pair — paid Render
     * tier can handle the load but it's still cheaper this way.
     *
     * <p>Sort order matches the rest of the app's class display: lowest
     * class first (LKG, UKG, 1st, ...). Sections within a class follow
     * their natural order on the SchoolClass document.</p>
     */
    public List<com.saas.school.modules.attendance.dto.DayAttendanceStatus> getDayStatus(
            String academicYearId, LocalDate date) {
        var out = new ArrayList<com.saas.school.modules.attendance.dto.DayAttendanceStatus>();
        if (academicYearId == null || academicYearId.isBlank() || date == null) return out;

        var classes = schoolClassRepository.findByAcademicYearId(academicYearId);
        if (classes == null || classes.isEmpty()) return out;

        // Pre-fetch every day-wise attendance row for this date in one query
        // and index by (classId, sectionId) so the card loop is O(1) lookup.
        // periodNumber=0 marks day-wise rows in the StudentsAttendance schema.
        var dayRows = batchRepository.findByDate(date);
        Map<String, StudentsAttendance> attendanceByPair = new HashMap<>();
        Set<String> absentStudentIds = new HashSet<>();
        if (dayRows != null) {
            for (StudentsAttendance r : dayRows) {
                if (r == null || r.getPeriodNumber() != 0) continue;
                if (r.getClassId() == null || r.getSectionId() == null) continue;
                attendanceByPair.put(r.getClassId() + "::" + r.getSectionId(), r);
                if (r.getEntries() != null) {
                    for (var e : r.getEntries()) {
                        if ("ABSENT".equals(e.getStatus()) && e.getStudentId() != null) {
                            absentStudentIds.add(e.getStudentId());
                        }
                    }
                }
            }
        }

        // Resolve absent studentIds → display name + roll number in one
        // batched query so the card list shows readable names instead of
        // opaque ids. Soft-deleted students drop out naturally; their entries
        // simply skip the name lookup and show as a bare id fallback below.
        Map<String, com.saas.school.modules.attendance.dto.DayAttendanceStatus.AbsentStudent> absentByStudentId =
                new HashMap<>();
        if (!absentStudentIds.isEmpty()) {
            var students = studentRepository.findByStudentIdInAndDeletedAtIsNull(
                    new ArrayList<>(absentStudentIds));
            if (students != null) {
                for (var s : students) {
                    String first = s.getFirstName() == null ? "" : s.getFirstName();
                    String last = s.getLastName() == null ? "" : s.getLastName();
                    String full = (first + " " + last).trim();
                    if (full.isEmpty()) full = s.getStudentId();
                    absentByStudentId.put(s.getStudentId(),
                            new com.saas.school.modules.attendance.dto.DayAttendanceStatus.AbsentStudent(
                                    s.getStudentId(), full, s.getRollNumber()));
                }
            }
        }

        // Same sort key the frontend uses elsewhere — numeric-aware so "10"
        // comes after "2" and LKG/UKG bubble up. We rely on the repo's order
        // for now and only sort if names look mixed.
        classes.sort((a, b) -> classNameSortKey(a.getName()).compareTo(classNameSortKey(b.getName())));

        for (var cls : classes) {
            if (cls.getSections() == null) continue;
            for (var sec : cls.getSections()) {
                var dto = new com.saas.school.modules.attendance.dto.DayAttendanceStatus();
                dto.setClassId(cls.getClassId());
                dto.setClassName(cls.getName());
                dto.setSectionId(sec.getSectionId());
                dto.setSectionName(sec.getName());
                dto.setStudentCount((int) studentRepository
                        .countByClassIdAndSectionIdAndDeletedAtIsNull(cls.getClassId(), sec.getSectionId()));

                StudentsAttendance rec = attendanceByPair.get(cls.getClassId() + "::" + sec.getSectionId());
                if (rec != null && rec.getEntries() != null && !rec.getEntries().isEmpty()) {
                    dto.setStatus(com.saas.school.modules.attendance.dto.DayAttendanceStatus.STATUS_MARKED);
                    dto.setMarkedAt(rec.getUpdatedAt() != null ? rec.getUpdatedAt() : rec.getCreatedAt());
                    int p = 0, a = 0, other = 0;
                    var absentees = new ArrayList<com.saas.school.modules.attendance.dto.DayAttendanceStatus.AbsentStudent>();
                    for (var e : rec.getEntries()) {
                        String s = e.getStatus();
                        if ("PRESENT".equals(s)) p++;
                        else if ("ABSENT".equals(s)) {
                            a++;
                            var ref = absentByStudentId.get(e.getStudentId());
                            // Fall back to a bare id when the lookup misses
                            // (e.g. student soft-deleted after being marked).
                            if (ref == null && e.getStudentId() != null) {
                                ref = new com.saas.school.modules.attendance.dto.DayAttendanceStatus.AbsentStudent(
                                        e.getStudentId(), e.getStudentId(), null);
                            }
                            if (ref != null) absentees.add(ref);
                        }
                        else if ("LATE".equals(s) || "HALF_DAY".equals(s)) other++;
                    }
                    // Stable display order — sort by roll number when present,
                    // else by name so the same Marked card shows the same list
                    // each render.
                    absentees.sort((x, y) -> {
                        String xr = x.getRollNumber();
                        String yr = y.getRollNumber();
                        if (xr != null && yr != null) {
                            return xr.compareToIgnoreCase(yr);
                        }
                        String xn = x.getFullName() == null ? "" : x.getFullName();
                        String yn = y.getFullName() == null ? "" : y.getFullName();
                        return xn.compareToIgnoreCase(yn);
                    });
                    dto.setPresentCount(p);
                    dto.setAbsentCount(a);
                    dto.setOtherCount(other);
                    dto.setAbsentees(absentees);
                } else {
                    dto.setStatus(com.saas.school.modules.attendance.dto.DayAttendanceStatus.STATUS_NOT_MARKED);
                }
                out.add(dto);
            }
        }
        return out;
    }

    /** Build a comparable key from a class name so "LKG", "UKG", "1st", "2nd"…
     *  "10th" sort in a humane order. LKG / UKG come first; the rest sort by
     *  the leading number with non-numeric strings falling back lexicographically. */
    private String classNameSortKey(String name) {
        if (name == null) return "zz";
        String n = name.trim().toUpperCase();
        if (n.startsWith("LKG")) return "00:" + n;
        if (n.startsWith("UKG")) return "01:" + n;
        // Pull leading digits.
        int i = 0;
        while (i < n.length() && Character.isDigit(n.charAt(i))) i++;
        if (i > 0) {
            try {
                int num = Integer.parseInt(n.substring(0, i));
                return String.format("%03d:%s", 10 + num, n);
            } catch (NumberFormatException ignored) {}
        }
        return "999:" + n;
    }

    public List<StudentsAttendance> getBatchAttendanceRange(
            String classId, String sectionId, LocalDate from, LocalDate to) {
        // Inclusive on both ends — see repository note. "May 1 to May 5"
        // returns records for all five days.
        return batchRepository.findByClassIdAndSectionIdAndDateGreaterThanEqualAndDateLessThanEqual(
                classId, sectionId, from, to);
    }

    // ── Student summary (from batch model) ──

    public AttendanceSummaryDto getStudentSummary(String studentId, LocalDate from, LocalDate to) {
        // Note: Can't query batch by embedded studentId directly.
        // For student dashboard, we'd need a secondary index or scan.
        // For now return empty — student-level summary needs enhancement.
        AttendanceSummaryDto summary = new AttendanceSummaryDto();
        summary.setStudentId(studentId);
        summary.setTotalDays(0);
        summary.setPresent(0);
        summary.setAbsent(0);
        summary.setLate(0);
        summary.setHalfDay(0);
        summary.setAttendancePercentage(0);
        return summary;
    }

    // ── SMS variable helpers ──────────────────────────────────────

    /**
     * Builds a human-friendly class label for the absence-alert var2 slot,
     * e.g. {@code "Class 10-A"}. The SchoolClass document holds the class
     * name and a list of sections; section name is appended when we can
     * locate the section by id. Returns {@code null} when neither piece
     * resolves so the caller falls back to a safe placeholder rather than
     * sending a blank variable.
     */
    /**
     * Enforce "only the assigned class teacher marks day-wise attendance".
     * The assignment lives in TeacherSubjectAssignment (the Teacher
     * Assignment module), not on the Class doc — so this gate stays
     * editable without re-saving the whole class every time a class
     * teacher rotates.
     *
     * <p>Logic:
     * <ul>
     *   <li>Resolve the caller's Teacher record by userId. If empty,
     *       the caller is a SCHOOL_ADMIN / PRINCIPAL (no Teacher row) →
     *       allow through.</li>
     *   <li>Look up TeacherSubjectAssignment rows for that teacher in the
     *       request's academic year. If any active row matches the
     *       request's classId + sectionId AND has role CLASS_TEACHER →
     *       allow.</li>
     *   <li>If no class-teacher row exists for this section at all, the
     *       section is in "setup mode" — allow any teacher through so
     *       attendance doesn't freeze before admins finish wiring up
     *       assignments.</li>
     *   <li>Otherwise reject with a friendly 400.</li>
     * </ul>
     */
    private void assertClassTeacherForDayWise(MarkAttendanceRequest req, String markedByUserId) {
        if (markedByUserId == null || markedByUserId.isBlank()) return;
        var teacherOpt = teacherRepository.findByUserIdAndDeletedAtIsNull(markedByUserId);
        if (teacherOpt.isEmpty()) return;  // Admin / principal — no Teacher row.
        String myTeacherId = teacherOpt.get().getTeacherId();
        String yearId = req.getAcademicYearId();

        // All assignments for this section in this year — used to decide
        // both "is the caller the class teacher" and "does a class teacher
        // exist at all" (the setup-mode fallback).
        List<TeacherSubjectAssignment> sectionAssignments = (yearId == null || yearId.isBlank())
                ? Collections.emptyList()
                : assignmentRepository.findByClassIdAndSectionIdAndAcademicYearId(
                        req.getClassId(), req.getSectionId(), yearId);

        boolean callerIsClassTeacher = sectionAssignments.stream()
                .anyMatch(a -> a != null
                        && a.getStatus() == TeacherSubjectAssignment.Status.ACTIVE
                        && a.getRoles() != null
                        && a.getRoles().contains(TeacherSubjectAssignment.Role.CLASS_TEACHER)
                        && myTeacherId.equals(a.getTeacherId()));
        if (callerIsClassTeacher) return;

        boolean anyClassTeacherAssigned = sectionAssignments.stream()
                .anyMatch(a -> a != null
                        && a.getStatus() == TeacherSubjectAssignment.Status.ACTIVE
                        && a.getRoles() != null
                        && a.getRoles().contains(TeacherSubjectAssignment.Role.CLASS_TEACHER));
        if (!anyClassTeacherAssigned) return;  // Setup mode — no one assigned yet.

        throw new IllegalArgumentException(
                "Only the assigned class teacher can mark day-wise attendance "
              + "for this section. Ask the school admin to update the class "
              + "teacher in Teacher Assignment if this is wrong.");
    }

    private String resolveClassLabel(String classId, String sectionId) {
        if (classId == null || classId.isBlank()) return null;
        try {
            SchoolClass sc = schoolClassRepository.findById(classId).orElse(null);
            if (sc == null) return null;
            String className = sc.getName() != null ? sc.getName().trim() : "";
            String sectionName = null;
            if (sectionId != null && sc.getSections() != null) {
                for (SchoolClass.Section sec : sc.getSections()) {
                    if (sec != null && sectionId.equals(sec.getSectionId())) {
                        sectionName = sec.getName();
                        break;
                    }
                }
            }
            if (className.isEmpty() && sectionName == null) return null;
            if (sectionName == null || sectionName.isBlank()) return className;
            if (className.isEmpty()) return "Section " + sectionName;
            return className + "-" + sectionName;
        } catch (Exception e) {
            log.warn("resolveClassLabel failed for classId={} sectionId={}: {}",
                    classId, sectionId, e.getMessage());
            return null;
        }
    }

    /**
     * Returns the subject's display name for the absence-alert var3 slot,
     * or {@code null} when the attendance batch has no subject (day-wise
     * marking) or the subject doc isn't found. Caller appends to the date.
     */
    private String resolveSubjectLabel(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return null;
        try {
            Subject sub = subjectRepository.findById(subjectId).orElse(null);
            if (sub == null) return null;
            String name = sub.getName();
            return (name == null || name.isBlank()) ? null : name.trim();
        } catch (Exception e) {
            log.warn("resolveSubjectLabel failed for subjectId={}: {}",
                    subjectId, e.getMessage());
            return null;
        }
    }
}
