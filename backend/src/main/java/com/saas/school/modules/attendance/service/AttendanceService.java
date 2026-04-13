package com.saas.school.modules.attendance.service;
import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate; import java.util.*;
@Service
public class AttendanceService {
    @Autowired private AttendanceRepository attendanceRepository;
    @Autowired private AuditService auditService;

    public List<Attendance> markAttendance(MarkAttendanceRequest req, String markedBy) {
        List<Attendance> saved = new ArrayList<>();
        for (var entry : req.getEntries()) {
            var existing = attendanceRepository
                .findByStudentIdAndDate(entry.getStudentId(), req.getDate());
            Attendance att = existing.orElseGet(() -> {
                Attendance a = new Attendance();
                a.setAttendanceId(UUID.randomUUID().toString());
                a.setClassId(req.getClassId());
                a.setSectionId(req.getSectionId());
                a.setAcademicYearId(req.getAcademicYearId());
                a.setStudentId(entry.getStudentId());
                a.setDate(req.getDate());
                return a;
            });
            att.setStatus(entry.getStatus());
            att.setRemarks(entry.getRemarks());
            att.setMarkedBy(markedBy);
            saved.add(attendanceRepository.save(att));
        }
        auditService.log("MARK_ATTENDANCE","Attendance","bulk",
            "Marked attendance for class "+req.getClassId()+" on "+req.getDate());
        return saved;
    }

    public AttendanceSummaryDto getStudentSummary(String studentId, LocalDate from, LocalDate to) {
        var records = attendanceRepository.findByStudentIdAndDateBetween(studentId, from, to);
        long total = records.size();
        long present = records.stream().filter(a -> a.getStatus()==Attendance.Status.PRESENT).count();
        long absent  = records.stream().filter(a -> a.getStatus()==Attendance.Status.ABSENT).count();
        long late    = records.stream().filter(a -> a.getStatus()==Attendance.Status.LATE).count();
        long half    = records.stream().filter(a -> a.getStatus()==Attendance.Status.HALF_DAY).count();
        double pct   = total > 0 ? (present * 100.0 / total) : 0.0;
        AttendanceSummaryDto summary = new AttendanceSummaryDto();
        summary.setStudentId(studentId);
        summary.setTotalDays(total);
        summary.setPresent(present);
        summary.setAbsent(absent);
        summary.setLate(late);
        summary.setHalfDay(half);
        summary.setAttendancePercentage(Math.round(pct * 10.0) / 10.0);
        return summary;
    }

    public List<Attendance> getClassAttendance(String classId, String sectionId, LocalDate date) {
        return attendanceRepository.findByClassIdAndSectionIdAndDate(classId, sectionId, date);
    }

    public List<Attendance> getClassAttendanceRange(String classId, String sectionId, LocalDate from, LocalDate to) {
        return attendanceRepository.findByClassIdAndSectionIdAndDateBetween(classId, sectionId, from, to);
    }
}