package com.saas.school.modules.biometric.repository;

import com.saas.school.modules.biometric.model.StudentBiometric;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StudentBiometricRepository extends MongoRepository<StudentBiometric, String> {

    Optional<StudentBiometric> findByStudentId(String studentId);

    List<StudentBiometric> findByStudentIdIn(List<String> studentIds);

    void deleteByStudentId(String studentId);
}
