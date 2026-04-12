package com.saas.school.modules.mcq.service;
import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.mcq.model.*;
import com.saas.school.modules.mcq.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Instant; import java.util.*; 
@Service @RequiredArgsConstructor
public class McqService {
    private final McqQuestionRepository questionRepo;
    private final McqExamRepository examRepo;
    private final McqResultRepository resultRepo;
    private final AuditService auditService;

    public McqQuestion createQuestion(McqQuestion q, String createdBy) {
        q.setQuestionId(UUID.randomUUID().toString());
        q.setCreatedBy(createdBy);
        return questionRepo.save(q);
    }

    public McqExam createExam(McqExam exam, String createdBy) {
        exam.setMcqExamId(UUID.randomUUID().toString());
        exam.setCreatedBy(createdBy);
        exam.setStatus(McqExam.ExamStatus.DRAFT);
        return examRepo.save(exam);
    }

    public McqExam publishExam(String examId) {
        McqExam exam = examRepo.findById(examId)
            .orElseThrow(() -> new ResourceNotFoundException("McqExam", examId));
        exam.setStatus(McqExam.ExamStatus.PUBLISHED);
        return examRepo.save(exam);
    }

    public McqResult startAttempt(String examId, String studentId) {
        McqExam exam = examRepo.findById(examId)
            .orElseThrow(() -> new ResourceNotFoundException("McqExam", examId));
        if (exam.getStatus() != McqExam.ExamStatus.PUBLISHED)
            throw new BusinessException("Exam is not available.");
        Instant now = Instant.now();
        if (now.isBefore(exam.getStartTime()) || now.isAfter(exam.getEndTime()))
            throw new BusinessException("Exam is not within the scheduled window.");
        if (resultRepo.findByMcqExamIdAndStudentId(examId, studentId).filter(McqResult::isSubmitted).isPresent())
            throw new BusinessException("You have already submitted this exam.");
        McqResult result = McqResult.builder()
            .resultId(UUID.randomUUID().toString())
            .mcqExamId(examId).studentId(studentId)
            .totalQuestions(exam.getQuestionIds().size())
            .answers(new ArrayList<>(Collections.nCopies(exam.getQuestionIds().size(), -1)))
            .startedAt(now).isSubmitted(false).build();
        return resultRepo.save(result);
    }

    public McqResult submitExam(String examId, String studentId, List<Integer> answers) {
        McqExam exam = examRepo.findById(examId)
            .orElseThrow(() -> new ResourceNotFoundException("McqExam", examId));
        McqResult result = resultRepo.findByMcqExamIdAndStudentId(examId, studentId)
            .orElseThrow(() -> new BusinessException("No active attempt found."));
        if (result.isSubmitted()) throw new BusinessException("Already submitted.");

        List<McqQuestion> questions = questionRepo.findAllById(exam.getQuestionIds());
        int correct = 0;
        for (int i = 0; i < questions.size(); i++) {
            if (i < answers.size() && answers.get(i) == questions.get(i).getCorrectOptionIndex()) correct++;
        }
        result.setAnswers(answers);
        result.setCorrectCount(correct);
        result.setScore(correct);
        result.setPercentage(questions.isEmpty() ? 0 : (correct * 100.0 / questions.size()));
        result.setSubmitted(true);
        result.setSubmittedAt(Instant.now());
        auditService.log("MCQ_SUBMIT","McqResult",result.getResultId(),"MCQ submitted by "+studentId);
        return resultRepo.save(result);
    }
}