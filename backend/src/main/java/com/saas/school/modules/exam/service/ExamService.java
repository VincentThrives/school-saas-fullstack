package com.saas.school.modules.exam.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.exam.dto.EnterMarksRequest;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ExamService {

    @Autowired private ExamRepository examRepository;
    @Autowired private ExamMarkRepository markRepository;
    @Autowired private AuditService auditService;

    public Exam createExam(Exam req) {
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
        auditService.log("DELETE_EXAM", "Exam", examId, "Exam deleted: " + exam.getName());
    }

    public List<Exam> listExams(String classId, String academicYearId) {
        if (classId != null && !classId.isBlank() && academicYearId != null && !academicYearId.isBlank()) {
            return examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        }
        if (classId != null && !classId.isBlank()) {
            return examRepository.findByClassIdAndAcademicYearId(classId, null);
        }
        // Return all exams when no filters
        return examRepository.findAll();
    }

    public List<ExamMark> enterMarks(EnterMarksRequest req, String teacherId) {
        Exam exam = examRepository.findById(req.getExamId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        if (exam.isMarksLocked()) {
            throw new BusinessException("Marks are locked for this exam. Contact school admin.");
        }

        List<ExamMark> saved = new ArrayList<>();
        for (var entry : req.getMarks()) {
            if (entry.getMarksObtained() < 0 || entry.getMarksObtained() > exam.getMaxMarks()) {
                throw new BusinessException("Marks must be between 0 and " + exam.getMaxMarks());
            }

            ExamMark mark = markRepository.findByExamIdAndStudentId(exam.getExamId(), entry.getStudentId())
                    .orElseGet(() -> {
                        ExamMark m = new ExamMark();
                        m.setMarkId(UUID.randomUUID().toString());
                        m.setExamId(exam.getExamId());
                        m.setStudentId(entry.getStudentId());
                        m.setTeacherId(teacherId);
                        return m;
                    });
            mark.setMarksObtained(entry.getMarksObtained());
            mark.setRemarks(entry.getRemarks());
            mark.setPassed(entry.getMarksObtained() >= exam.getPassingMarks());
            mark.setGrade(computeGrade(entry.getMarksObtained(), exam.getMaxMarks()));
            saved.add(markRepository.save(mark));
        }
        auditService.log("ENTER_MARKS", "Exam", exam.getExamId(),
                "Marks entered for " + saved.size() + " students");
        return saved;
    }

    public void lockMarks(String examId) {
        Exam exam = getExamById(examId);
        exam.setMarksLocked(true);
        examRepository.save(exam);
        auditService.log("LOCK_MARKS", "Exam", examId, "Marks locked for exam: " + exam.getName());
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
