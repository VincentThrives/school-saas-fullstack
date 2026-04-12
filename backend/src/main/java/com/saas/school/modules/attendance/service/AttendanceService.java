package com.saas.school.modules.attendance.service;
import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.attendance.dto.*;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate; import java.util.*;
@Service @RequiredArgsConstructor
public class AttendanceService {
    private final AttendanceRepository attendanceRepository;
    private final AuditService auditService;

    public List<Attendance> markAttendance(MarkAttendanceRequest req, String markedBy) {
        List<Attendance> saved = new ArrayList<>();
        for (var entry : req.getEntries()) {
            var existing = attendanceRepository
                .findByStudentIdAndDate(entry.getStudentId(), req.getDate());
            Attendance att = existing.orElseGet(() -> Attendance.builder()
                .attendanceId(UUID.randomUUID().toString())
                .classId(req.getClassId()).sectionId(req.getSectionId())
                .academicYearId(req.getAcademicYearId())
                .studentId(entry.getStudentId())
                .date(req.getDate()).build());
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
        return AttendanceSummaryDto.builder()
            .studentId(studentId).totalDays(total).present(present)
            .absent(absent).late(late).halfDay(half)
            .attendancePercentage(Math.round(pct * 10.0) / 10.0).build();
    }

    public List<Attendance> getClassAttendance(String classId, String sectionId, LocalDate date) {
        return attendanceRepository.findByClassIdAndSectionIdAndDate(classId, sectionId, date);
    }
}