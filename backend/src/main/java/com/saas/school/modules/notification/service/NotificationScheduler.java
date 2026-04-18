package com.saas.school.modules.notification.service;

import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationRuleEngine.FirePayload;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;

/**
 * Scheduled jobs that fire time-based auto rules. Event-based rules
 * (Absence Alert, Holiday Declared, etc.) are fired inline from the
 * relevant domain services, not here.
 */
@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);

    @Autowired private NotificationRuleEngine ruleEngine;
    @Autowired private ExamRepository examRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentsAttendanceRepository attendanceRepository;

    /** Daily at 18:00 — remind about tomorrow's exams. */
    @Scheduled(cron = "0 0 18 * * *")
    public void sendExamReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        log.info("[NotificationScheduler] Exam reminders scan for {}", tomorrow);
        try {
            List<Exam> exams = examRepository.findByExamDate(tomorrow);
            for (Exam e : exams) {
                Map<String, Object> vars = new HashMap<>();
                vars.put("subject", e.getSubjectName() != null ? e.getSubjectName() : "Exam");
                vars.put("date", tomorrow.toString());
                vars.put("time", e.getStartTime() != null ? e.getStartTime() : "");
                vars.put("examType", e.getExamType() != null ? e.getExamType() : "");

                ruleEngine.fire("EXAM_REMINDER", FirePayload.toClass(e.getClassId())
                        .entityId(e.getExamId())
                        .dateKey(tomorrow.toString())
                        .type(Notification.NotificationType.EXAM)
                        .vars(vars)
                        .fallback("Exam tomorrow: " + vars.get("subject"),
                                "Reminder: " + vars.get("subject") + " exam on " + vars.get("date")
                                        + (vars.get("time") != null && !"".equals(vars.get("time"))
                                            ? " at " + vars.get("time") : "") + "."));
            }
        } catch (Exception ex) {
            log.error("Exam reminder job failed: {}", ex.getMessage(), ex);
        }
    }

    /** Weekly on Mondays at 08:00 — flag students below 75% attendance for the last 30 days. */
    @Scheduled(cron = "0 0 8 * * MON")
    public void sendLowAttendanceAlerts() {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(30);
        log.info("[NotificationScheduler] Low attendance scan {} to {}", from, today);
        try {
            List<Student> students = studentRepository.findByDeletedAtIsNull();
            for (Student s : students) {
                double pct = percentFor(s.getStudentId(), from, today);
                if (pct >= 75.0 || pct < 0) continue;

                List<String> recipients = new ArrayList<>();
                if (s.getParentIds() != null) recipients.addAll(s.getParentIds());
                if (s.getUserId() != null) recipients.add(s.getUserId());
                if (recipients.isEmpty()) continue;

                String name = s.getFirstName() != null
                        ? s.getFirstName() + (s.getLastName() != null ? " " + s.getLastName() : "")
                        : "Student " + (s.getAdmissionNumber() != null ? s.getAdmissionNumber() : "");

                Map<String, Object> vars = new HashMap<>();
                vars.put("student", name);
                vars.put("percent", String.format("%.1f", pct));

                ruleEngine.fire("LOW_ATTENDANCE", FirePayload.toIndividuals(recipients)
                        .entityId(s.getStudentId())
                        .dateKey(today.toString())
                        .type(Notification.NotificationType.ATTENDANCE)
                        .vars(vars)
                        .fallback("Attendance below 75%",
                                name + "'s attendance is " + vars.get("percent")
                                        + "%, below the 75% required minimum."));
            }
        } catch (Exception ex) {
            log.error("Low attendance job failed: {}", ex.getMessage(), ex);
        }
    }

    /** Student attendance % over a date range, across every attendance record that includes them. */
    private double percentFor(String studentId, LocalDate from, LocalDate to) {
        // Aggregate across every StudentsAttendance record that contains this student in the window.
        // Cheap-and-correct implementation: scan records whose date is in range; count PRESENT/LATE vs total.
        long total = 0, present = 0;
        // Since there's no direct StudentsAttendance.findByDateBetween, iterate by class is expensive;
        // we rely on a lightweight heuristic: fetch all records (ok for MVP), then filter in memory.
        for (StudentsAttendance rec : attendanceRepository.findAll()) {
            if (rec.getDate() == null || rec.getDate().isBefore(from) || rec.getDate().isAfter(to)) continue;
            if (rec.getEntries() == null) continue;
            for (StudentsAttendance.StudentEntry entry : rec.getEntries()) {
                if (!studentId.equals(entry.getStudentId())) continue;
                total++;
                if ("PRESENT".equalsIgnoreCase(entry.getStatus()) || "LATE".equalsIgnoreCase(entry.getStatus())) {
                    present++;
                }
            }
        }
        if (total == 0) return -1;
        return (present * 100.0) / total;
    }
}
