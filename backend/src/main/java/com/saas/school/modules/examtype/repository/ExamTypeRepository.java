package com.saas.school.modules.examtype.repository;

import com.saas.school.modules.examtype.model.ExamType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ExamTypeRepository extends MongoRepository<ExamType, String> {
    List<ExamType> findAllByOrderByDisplayOrderAscNameAsc();
    List<ExamType> findByStatusOrderByDisplayOrderAscNameAsc(ExamType.Status status);
    Optional<ExamType> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
