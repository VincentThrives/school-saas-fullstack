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
import java.util.*; 
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

    public List<Exam> listExams(String classId, String academicYearId) {
        return examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
    }

    public List<ExamMark> enterMarks(EnterMarksRequest req, String teacherId) {
        Exam exam = examRepository.findById(req.getExamId())
            .orElseThrow(() -> new ResourceNotFoundException("Exam", req.getExamId()));
        if (exam.isMarksLocked())
            throw new BusinessException("Marks are locked for this exam. Contact school admin.");

        List<ExamMark> saved = new ArrayList<>();
        for (var entry : req.getMarks()) {
            if (entry.getMarksObtained() < 0 || entry.getMarksObtained() > exam.getMaxMarks())
                throw new BusinessException("Marks must be between 0 and " + exam.getMaxMarks());

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
        auditService.log("ENTER_MARKS","Exam",exam.getExamId(),"Marks entered for "+saved.size()+" students");
        return saved;
    }

    public void lockMarks(String examId) {
        Exam exam = examRepository.findById(examId)
            .orElseThrow(() -> new ResourceNotFoundException("Exam", examId));
        exam.setMarksLocked(true);
        examRepository.save(exam);
    }

    private String computeGrade(double marks, int max) {
        double pct = marks / max * 100;
        if (pct >= 90) return "A+";
        if (pct >= 80) return "A";
        if (pct >= 70) return "B";
        if (pct >= 60) return "C";
        if (pct >= 50) return "D";
        return "F";
    }
}