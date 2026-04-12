package com.saas.school.modules.assignment.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.assignment.dto.CreateAssignmentRequest;
import com.saas.school.modules.assignment.dto.GradeSubmissionRequest;
import com.saas.school.modules.assignment.dto.SubmitAssignmentRequest;
import com.saas.school.modules.assignment.model.Assignment;
import com.saas.school.modules.assignment.model.AssignmentSubmission;
import com.saas.school.modules.assignment.repository.AssignmentRepository;
import com.saas.school.modules.assignment.repository.AssignmentSubmissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AssignmentService {

    private static final Logger logger = LoggerFactory.getLogger(AssignmentService.class);

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Autowired
    private AssignmentSubmissionRepository submissionRepository;

    public Assignment createAssignment(CreateAssignmentRequest req, String teacherId, String teacherName) {
        Assignment assignment = new Assignment();
        assignment.setId(UUID.randomUUID().toString());
        assignment.setTitle(req.getTitle());
        assignment.setDescription(req.getDescription());
        assignment.setClassId(req.getClassId());
        assignment.setSectionId(req.getSectionId());
        assignment.setSubjectId(req.getSubjectId());
        assignment.setDueDate(Instant.parse(req.getDueDate()));
        assignment.setMaxMarks(req.getMaxMarks());
        assignment.setTeacherId(teacherId);
        assignment.setTeacherName(teacherName);
        assignment.setStatus(Assignment.AssignmentStatus.DRAFT);
        assignment.setTotalSubmissions(0);
        assignment.setGradedCount(0);

        logger.info("Creating assignment '{}' by teacher {}", req.getTitle(), teacherId);
        return assignmentRepository.save(assignment);
    }

    public Assignment publishAssignment(String assignmentId) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));

        if (assignment.getStatus() != Assignment.AssignmentStatus.DRAFT) {
            throw new BusinessException("Only DRAFT assignments can be published");
        }

        assignment.setStatus(Assignment.AssignmentStatus.PUBLISHED);
        logger.info("Publishing assignment {}", assignmentId);
        return assignmentRepository.save(assignment);
    }

    public Assignment closeAssignment(String assignmentId) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));

        if (assignment.getStatus() != Assignment.AssignmentStatus.PUBLISHED) {
            throw new BusinessException("Only PUBLISHED assignments can be closed");
        }

        assignment.setStatus(Assignment.AssignmentStatus.CLOSED);
        logger.info("Closing assignment {}", assignmentId);
        return assignmentRepository.save(assignment);
    }

    public AssignmentSubmission submitAssignment(String assignmentId, String studentId,
                                                  String studentName, SubmitAssignmentRequest req) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));

        if (assignment.getStatus() != Assignment.AssignmentStatus.PUBLISHED) {
            throw new BusinessException("Assignment is not open for submissions");
        }

        submissionRepository.findByAssignmentIdAndStudentId(assignmentId, studentId)
                .ifPresent(s -> {
                    throw new BusinessException("You have already submitted this assignment");
                });

        Instant now = Instant.now();
        boolean late = now.isAfter(assignment.getDueDate());

        AssignmentSubmission submission = new AssignmentSubmission();
        submission.setId(UUID.randomUUID().toString());
        submission.setAssignmentId(assignmentId);
        submission.setStudentId(studentId);
        submission.setStudentName(studentName);
        submission.setSubmittedAt(now);
        submission.setTextResponse(req.getTextResponse());
        submission.setAttachmentUrl(req.getAttachmentUrl());
        submission.setAttachmentName(req.getAttachmentName());
        submission.setLate(late);
        submission.setStatus(late ? AssignmentSubmission.SubmissionStatus.LATE
                                  : AssignmentSubmission.SubmissionStatus.SUBMITTED);

        AssignmentSubmission saved = submissionRepository.save(submission);

        // Update submission count
        assignment.setTotalSubmissions(assignment.getTotalSubmissions() + 1);
        assignmentRepository.save(assignment);

        logger.info("Student {} submitted assignment {} (late={})", studentId, assignmentId, late);
        return saved;
    }

    public AssignmentSubmission gradeSubmission(String submissionId, GradeSubmissionRequest req,
                                                 String graderId) {
        AssignmentSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", submissionId));

        Assignment assignment = assignmentRepository.findById(submission.getAssignmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", submission.getAssignmentId()));

        if (req.getMarksAwarded() < 0 || req.getMarksAwarded() > assignment.getMaxMarks()) {
            throw new BusinessException("Marks must be between 0 and " + assignment.getMaxMarks());
        }

        submission.setMarksAwarded(req.getMarksAwarded());
        submission.setRemarks(req.getRemarks());
        submission.setGradedBy(graderId);
        submission.setGradedAt(Instant.now());
        submission.setStatus(AssignmentSubmission.SubmissionStatus.GRADED);

        AssignmentSubmission saved = submissionRepository.save(submission);

        // Update graded count
        assignment.setGradedCount(assignment.getGradedCount() + 1);
        assignmentRepository.save(assignment);

        logger.info("Graded submission {} with marks {}/{}", submissionId,
                req.getMarksAwarded(), assignment.getMaxMarks());
        return saved;
    }

    public Page<Assignment> getAssignmentsByClass(String classId, Pageable pageable) {
        return assignmentRepository.findByClassIdAndDeletedAtIsNull(classId, pageable);
    }

    public Page<Assignment> getAssignmentsByTeacher(String teacherId, Pageable pageable) {
        return assignmentRepository.findByTeacherId(teacherId, pageable);
    }

    public Assignment getAssignmentById(String assignmentId) {
        return assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));
    }

    public Page<AssignmentSubmission> getSubmissions(String assignmentId, Pageable pageable) {
        return submissionRepository.findByAssignmentId(assignmentId, pageable);
    }

    public Map<String, Object> getStats(String assignmentId) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment", assignmentId));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSubmissions", assignment.getTotalSubmissions());
        stats.put("gradedCount", assignment.getGradedCount());
        stats.put("maxMarks", assignment.getMaxMarks());
        stats.put("status", assignment.getStatus());
        return stats;
    }
}
