package com.saas.school.modules.exam.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.exam.dto.EnterMarksRequest;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExamService {

    @Autowired private ExamRepository examRepository;
    @Autowired private ExamMarkRepository markRepository;
    @Autowired private StudentAssessmentsRepository assessmentsRepository;
    @Autowired private AuditService auditService;

    public Exam createExam(Exam req) {
        if (req.getSubjectId() == null || req.getSubjectId().isEmpty()) {
            throw new IllegalArgumentException("Subject is required");
        }
        if (req.getClassId() == null || req.getClassId().isEmpty()) {
            throw new IllegalArgumentException("Class is required");
        }
        req.setExamId(UUID.randomUUID().toString());
        req.setStatus(Exam.ExamStatus.SCHEDULED);
        return examRepository.save(req);
    }

    public Exam getExamById(String examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
    }

    public Exam updateExam(String examId, Exam req) {
        Exam exam = getExamById(examId);
        if (exam.isMarksLocked()) {
            throw new BusinessException("Cannot edit exam — marks are locked.");
        }
        req.setExamId(examId);
        req.setStatus(exam.getStatus());
        req.setMarksLocked(exam.isMarksLocked());
        return examRepository.save(req);
    }

    public void deleteExam(String examId) {
        Exam exam = getExamById(examId);
        if (exam.isMarksLocked()) {
            throw new BusinessException("Cannot delete exam — marks are locked.");
        }
        examRepository.deleteById(examId);
        // Also delete batch assessment
        assessmentsRepository.findByExamId(examId).ifPresent(a -> assessmentsRepository.delete(a));
        auditService.log("DELETE_EXAM", "Exam", examId, "Exam deleted: " + exam.getName());
    }

    public List<Exam> listExams(String classId, String academicYearId) {
        if (classId != null && !classId.isBlank() && academicYearId != null && !academicYearId.isBlank()) {
            return examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        }
        return examRepository.findAll();
    }

    // ── NEW: Batch marks entry (1 document per exam) ──

    public StudentAssessments enterBatchMarks(EnterMarksRequest req, String teacherId) {
        Exam exam = examRepository.findById(req.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        if (exam.isMarksLocked()) {
            throw new BusinessException("Marks are locked for this exam. Contact school admin.");
        }

        // Upsert batch document
        StudentAssessments assessment = assessmentsRepository.findByExamId(exam.getExamId())
                .orElseGet(() -> {
                    StudentAssessments a = new StudentAssessments();
                    a.setId(UUID.randomUUID().toString());
                    a.setExamId(exam.getExamId());
                    a.setAcademicYearId(exam.getAcademicYearId());
                    a.setClassId(exam.getClassId());
                    a.setSectionId(exam.getSectionId());
                    a.setSubjectId(exam.getSubjectId());
                    return a;
                });

        assessment.setTeacherId(teacherId);

        // Build entries
        List<StudentAssessments.MarkEntry> entries = new ArrayList<>();
        for (var e : req.getMarks()) {
            if (e.getMarksObtained() < 0 || e.getMarksObtained() > exam.getMaxMarks()) {
                throw new BusinessException("Marks must be between 0 and " + exam.getMaxMarks());
            }
            boolean passed = e.getMarksObtained() >= exam.getPassingMarks();
            String grade = computeGrade(e.getMarksObtained(), exam.getMaxMarks());
            entries.add(new StudentAssessments.MarkEntry(
                    e.getStudentId(), e.getMarksObtained(), grade, e.getRemarks(), passed));
        }
        assessment.setEntries(entries);

        assessmentsRepository.save(assessment);
        auditService.log("ENTER_MARKS", "StudentAssessments", assessment.getId(),
                "Batch marks entered for " + entries.size() + " students, exam: " + exam.getName());
        return assessment;
    }

    // ── Get marks for an exam (from batch) ──

    public List<StudentAssessments.MarkEntry> getBatchMarks(String examId) {
        return assessmentsRepository.findByExamId(examId)
                .map(StudentAssessments::getEntries)
                .orElse(Collections.emptyList());
    }

    // ── Results from batch ──

    public Map<String, Object> getExamResults(String examId) {
        Exam exam = getExamById(examId);

        // Try batch first
        Optional<StudentAssessments> batchOpt = assessmentsRepository.findByExamId(examId);
        List<StudentAssessments.MarkEntry> entries;

        if (batchOpt.isPresent() && batchOpt.get().getEntries() != null && !batchOpt.get().getEntries().isEmpty()) {
            entries = batchOpt.get().getEntries();
        } else {
            // Fallback to old model
            List<ExamMark> oldMarks = markRepository.findByExamId(examId);
            entries = oldMarks.stream().map(m -> new StudentAssessments.MarkEntry(
                    m.getStudentId(), m.getMarksObtained(), m.getGrade(), m.getRemarks(), m.isPassed()
            )).toList();
        }

        int total = entries.size();
        long passed = entries.stream().filter(StudentAssessments.MarkEntry::isPassed).count();
        long failed = total - passed;
        double passPercent = total > 0 ? Math.round(passed * 1000.0 / total) / 10.0 : 0;
        double avg = total > 0 ? Math.round(entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).average().orElse(0) * 10.0) / 10.0 : 0;
        double highest = entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).max().orElse(0);
        double lowest = entries.stream().mapToDouble(StudentAssessments.MarkEntry::getMarksObtained).min().orElse(0);

        Map<String, Long> gradeDist = entries.stream()
                .collect(Collectors.groupingBy(e -> e.getGrade() != null ? e.getGrade() : "?", Collectors.counting()));

        List<Map<String, Object>> toppers = entries.stream()
                .sorted((a, b) -> Double.compare(b.getMarksObtained(), a.getMarksObtained()))
                .limit(5)
                .map(m -> {
                    Map<String, Object> t = new HashMap<>();
                    t.put("studentId", m.getStudentId());
                    t.put("marksObtained", m.getMarksObtained());
                    t.put("grade", m.getGrade());
                    t.put("percentage", Math.round(m.getMarksObtained() / exam.getMaxMarks() * 1000.0) / 10.0);
                    return t;
                }).toList();

        // Convert entries to allMarks format for frontend compat
        List<Map<String, Object>> allMarks = entries.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", e.getStudentId());
            m.put("marksObtained", e.getMarksObtained());
            m.put("grade", e.getGrade());
            m.put("remarks", e.getRemarks());
            m.put("isPassed", e.isPassed());
            return m;
        }).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("examId", examId);
        result.put("examName", exam.getName());
        result.put("className", exam.getClassName());
        result.put("subjectName", exam.getSubjectName());
        result.put("maxMarks", exam.getMaxMarks());
        result.put("passingMarks", exam.getPassingMarks());
        result.put("totalStudents", total);
        result.put("passed", passed);
        result.put("failed", failed);
        result.put("passPercentage", passPercent);
        result.put("classAverage", avg);
        result.put("highestMarks", highest);
        result.put("lowestMarks", lowest);
        result.put("gradeDistribution", gradeDist);
        result.put("toppers", toppers);
        result.put("allMarks", allMarks);
        return result;
    }

    // ── Lock/Unlock ──

    public void lockMarks(String examId) {
        Exam exam = getExamById(examId);
        exam.setMarksLocked(true);
        examRepository.save(exam);
        auditService.log("LOCK_MARKS", "Exam", examId, "Marks locked for exam: " + exam.getName());
    }

    public void unlockMarks(String examId) {
        Exam exam = getExamById(examId);
        exam.setMarksLocked(false);
        examRepository.save(exam);
        auditService.log("UNLOCK_MARKS", "Exam", examId, "Marks unlocked for exam: " + exam.getName());
    }

    // ── Legacy ──

    public List<ExamMark> getStudentMarks(String studentId) {
        return markRepository.findByStudentId(studentId);
    }

    public List<Exam> getUpcomingExams() {
        return examRepository.findAll().stream()
            .filter(e -> e.getExamDate() != null)
            .sorted((a, b) -> a.getExamDate().compareTo(b.getExamDate()))
            .toList();
    }

    private String computeGrade(double marks, int max) {
        double pct = marks / max * 100;
        if (pct >= 90) return "A+";
        if (pct >= 80) return "A";
        if (pct >= 70) return "B+";
        if (pct >= 60) return "B";
        if (pct >= 50) return "C";
        if (pct >= 40) return "D";
        return "F";
    }
}
