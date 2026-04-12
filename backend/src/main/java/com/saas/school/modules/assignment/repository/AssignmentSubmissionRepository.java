package com.saas.school.modules.assignment.repository;

import com.saas.school.modules.assignment.model.AssignmentSubmission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AssignmentSubmissionRepository extends MongoRepository<AssignmentSubmission, String> {

    Page<AssignmentSubmission> findByAssignmentId(String assignmentId, Pageable pageable);

    List<AssignmentSubmission> findByStudentId(String studentId);

    Optional<AssignmentSubmission> findByAssignmentIdAndStudentId(String assignmentId, String studentId);
}
