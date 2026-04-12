package com.saas.school.modules.assignment.repository;

import com.saas.school.modules.assignment.model.Assignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface AssignmentRepository extends MongoRepository<Assignment, String> {

    Page<Assignment> findByClassIdAndDeletedAtIsNull(String classId, Pageable pageable);

    Page<Assignment> findByTeacherId(String teacherId, Pageable pageable);

    List<Assignment> findByStatus(Assignment.AssignmentStatus status);
}
