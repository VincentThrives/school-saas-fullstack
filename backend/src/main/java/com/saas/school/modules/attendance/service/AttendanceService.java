package com.saas.school.modules.attendance.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationRuleEngine;
import com.saas.school.modules.notification.service.NotificationRuleEngine.FirePayload;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.timetable.model.Timetable;
import com.saas.school.modules.timetable.repository.TimetableRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    @Autowired private StudentsAttendanceRepository batchRepository;
    @Autowired private TimetableRepository timetableRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private SchoolEventRepository eventRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private NotificationRuleEngine ruleEngine;
    @Autowired private AuditService auditService;

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

        int period = req.getPeriodNumber();  // 0 for day-wise

        // Upsert: find existing or create new
        Optional<StudentsAttendance> existing = batchRepository
                .findByClassIdAndSectionIdAndDateAndPeriodNumber(
                        req.getClassId(), req.getSectionId(), req.getDate(), period);

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
        fireAbsenceAlerts(entries, req.getDate());
        return record;
    }

    private void fireAbsenceAlerts(List<StudentsAttendance.StudentEntry> entries, LocalDate date) {
        if (entries == null || date == null) return;
        String dateKey = date.toString();
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

            Map<String, Object> vars = new HashMap<>();
            vars.put("student", name);
            vars.put("date", dateKey);

            FirePayload payload = FirePayload.toIndividuals(recipients)
                    .entityId(e.getStudentId())
                    .dateKey(dateKey)
                    .type(Notification.NotificationType.ATTENDANCE)
                    .vars(vars)
                    .fallback("Absent today",
                            "Dear Parent, " + name + " was marked absent on " + dateKey + ".");
            ruleEngine.fire("ABSENCE_ALERT", payload);
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

    public List<StudentsAttendance> getBatchAttendanceRange(
            String classId, String sectionId, LocalDate from, LocalDate to) {
        return batchRepository.findByClassIdAndSectionIdAndDateBetween(classId, sectionId, from, to);
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
}
