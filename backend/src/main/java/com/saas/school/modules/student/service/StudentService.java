package com.saas.school.modules.student.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class StudentService {

    private static final Logger log = LoggerFactory.getLogger(StudentService.class);

    @Autowired private StudentRepository studentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    @Autowired private MongoTemplate mongoTemplate;

    public PageResponse<StudentDto> listStudents(int page, int size,
                                                  String classId, String sectionId, String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Student> result;

        if (search != null && !search.isBlank()) {
            result = studentRepository.searchStudents(search, pageable);
        } else if (classId != null && sectionId != null) {
            result = studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(classId, sectionId, pageable);
        } else if (classId != null) {
            result = studentRepository.findByClassIdAndDeletedAtIsNull(classId, pageable);
        } else {
            result = studentRepository.findByDeletedAtIsNull(pageable);
        }

        return PageResponse.of(result.getContent().stream().map(this::toDto).toList(),
                result.getTotalElements(), page, size);
    }

    public StudentDto getStudent(String studentId) {
        return toDto(findStudent(studentId));
    }

    public StudentDto createStudent(CreateStudentRequest req) {
        if (studentRepository.findByAdmissionNumberAndDeletedAtIsNull(req.getAdmissionNumber()).isPresent()) {
            throw new BusinessException("Admission number already exists: " + req.getAdmissionNumber());
        }

        Student student = new Student();
        student.setStudentId(UUID.randomUUID().toString());
        student.setUserId(req.getUserId());
        student.setFirstName(req.getFirstName());
        student.setLastName(req.getLastName());
        student.setPhone(req.getPhone());
        student.setEmail(req.getEmail());
        student.setAdmissionNumber(req.getAdmissionNumber());
        student.setRollNumber(req.getRollNumber());
        student.setClassId(req.getClassId());
        student.setSectionId(req.getSectionId());
        student.setAcademicYearId(req.getAcademicYearId());
        student.setParentIds(req.getParentIds());
        student.setDateOfBirth(req.getDateOfBirth());
        student.setGender(req.getGender());
        student.setBloodGroup(req.getBloodGroup());
        student.setAddress(mapAddress(req.getAddress()));
        student.setParentName(req.getParentName());
        student.setParentPhone(req.getParentPhone());
        student.setParentEmail(req.getParentEmail());
        student.setSubjectIds(req.getSubjectIds());

        // Create first academic record
        Student.AcademicRecord record = new Student.AcademicRecord(
                req.getAcademicYearId(), req.getClassId(), req.getSectionId(),
                req.getSubjectIds(), true);
        List<Student.AcademicRecord> records = new ArrayList<>();
        records.add(record);
        student.setAcademicRecords(records);

        // Auto-create User account for login
        String generatedUserId = autoCreateUserForStudent(student, req);
        if (generatedUserId != null) {
            student.setUserId(generatedUserId);
        }

        studentRepository.save(student);
        auditService.log("CREATE_STUDENT", "Student", student.getStudentId(),
                "Student created: " + student.getAdmissionNumber());
        return toDto(student);
    }

    public StudentDto updateStudent(String studentId, UpdateStudentRequest req) {
        Student s = findStudent(studentId);
        if (req.getFirstName()     != null) s.setFirstName(req.getFirstName());
        if (req.getLastName()      != null) s.setLastName(req.getLastName());
        if (req.getPhone()         != null) s.setPhone(req.getPhone());
        if (req.getEmail()         != null) s.setEmail(req.getEmail());
        if (req.getRollNumber()    != null) s.setRollNumber(req.getRollNumber());
        if (req.getClassId()       != null) s.setClassId(req.getClassId());
        if (req.getSectionId()     != null) s.setSectionId(req.getSectionId());
        if (req.getGender()        != null) s.setGender(req.getGender());
        if (req.getDateOfBirth()   != null) s.setDateOfBirth(req.getDateOfBirth());
        if (req.getBloodGroup()    != null) s.setBloodGroup(req.getBloodGroup());
        if (req.getAddress()       != null) s.setAddress(mapAddress(req.getAddress()));
        if (req.getParentName()    != null) s.setParentName(req.getParentName());
        if (req.getParentPhone()   != null) s.setParentPhone(req.getParentPhone());
        if (req.getParentEmail()   != null) s.setParentEmail(req.getParentEmail());
        if (req.getSubjectIds()    != null) s.setSubjectIds(req.getSubjectIds());

        // Sync active academic record with updated top-level fields
        Student.AcademicRecord active = s.getActiveRecord();
        if (active != null) {
            active.setClassId(s.getClassId());
            active.setSectionId(s.getSectionId());
            active.setSubjectIds(s.getSubjectIds());
        }

        studentRepository.save(s);
        auditService.log("UPDATE_STUDENT", "Student", studentId, "Student updated");
        return toDto(s);
    }

    public void deleteStudent(String studentId) {
        Student s = findStudent(studentId);
        s.setDeletedAt(Instant.now());
        studentRepository.save(s);
        auditService.log("DELETE_STUDENT", "Student", studentId, "Student soft deleted");
    }

    /** Year-end bulk promotion: move all students in classId/sectionId to nextClassId/nextSectionId */
    public BulkPromoteResult bulkPromote(BulkPromoteRequest req) {
        var students = studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(
                req.getFromClassId(), req.getFromSectionId());
        int promoted = 0, skipped = 0;

        for (Student s : students) {
            if (req.getExcludedStudentIds() != null
                    && req.getExcludedStudentIds().contains(s.getStudentId())) {
                skipped++;
                continue;
            }

            // Deactivate current active record (preserve history)
            if (s.getAcademicRecords() != null) {
                s.getAcademicRecords().forEach(r -> r.setActive(false));
            } else {
                // Migrate legacy student: create a record from current flat fields
                List<Student.AcademicRecord> records = new ArrayList<>();
                records.add(new Student.AcademicRecord(
                        s.getAcademicYearId(), s.getClassId(), s.getSectionId(),
                        s.getSubjectIds(), false));
                s.setAcademicRecords(records);
            }

            // Add new active record for the promoted class
            Student.AcademicRecord newRecord = new Student.AcademicRecord(
                    req.getToAcademicYearId(), req.getToClassId(), req.getToSectionId(),
                    null, true);
            s.getAcademicRecords().add(newRecord);

            // Sync top-level fields from new active record
            s.setClassId(req.getToClassId());
            s.setSectionId(req.getToSectionId());
            s.setAcademicYearId(req.getToAcademicYearId());
            s.setSubjectIds(null); // subjects for new class to be assigned later

            studentRepository.save(s);
            promoted++;
        }

        auditService.log("BULK_PROMOTE", "Student", "bulk",
                "Promoted " + promoted + " students to class " + req.getToClassId());
        return new BulkPromoteResult(promoted, skipped);
    }

    // ── Auto User Creation ─────────────────────────────────────────

    private String autoCreateUserForStudent(Student student, CreateStudentRequest req) {
        try {
            String loginId = req.getAdmissionNumber();
            String firstName = req.getFirstName() != null ? req.getFirstName() : "Student";
            int birthYear = req.getDateOfBirth() != null ? req.getDateOfBirth().getYear() : 2000;
            String password = firstName + "@" + birthYear;

            // Check if user with this email/username already exists
            String email = req.getEmail() != null && !req.getEmail().isEmpty()
                    ? req.getEmail() : loginId + "@student.school";
            if (userRepository.existsByEmailAndDeletedAtIsNull(email)) {
                log.warn("User with email {} already exists, skipping auto-create", email);
                // Try to find and link existing user
                return userRepository.findByEmailAndDeletedAtIsNull(email)
                        .map(User::getUserId).orElse(null);
            }

            User user = new User();
            user.setUserId(UUID.randomUUID().toString());
            user.setTenantId(TenantContext.getTenantId());
            user.setEmail(email);
            user.setUsername(loginId);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setRole(UserRole.STUDENT);
            user.setFirstName(req.getFirstName());
            user.setLastName(req.getLastName());
            user.setPhone(req.getPhone());
            user.setActive(true);
            user.setLocked(false);
            user.setFailedLoginAttempts(0);
            user.setCreatedAt(Instant.now());

            userRepository.save(user);
            log.info("Auto-created User for student: loginId={}, password={}", loginId, password);
            return user.getUserId();
        } catch (Exception e) {
            log.error("Failed to auto-create User for student: {}", e.getMessage());
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Student findStudent(String studentId) {
        return studentRepository.findById(studentId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
    }

    private Student.Address mapAddress(CreateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        Student.Address address = new Student.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setZip(dto.getZip());
        return address;
    }

    private Student.Address mapAddress(UpdateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        Student.Address address = new Student.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setZip(dto.getZip());
        return address;
    }

    public StudentDto toDto(Student s) {
        StudentDto dto = new StudentDto();
        dto.setStudentId(s.getStudentId());
        dto.setUserId(s.getUserId());
        dto.setFirstName(s.getFirstName());
        dto.setLastName(s.getLastName());
        dto.setPhone(s.getPhone());
        dto.setEmail(s.getEmail());
        dto.setAdmissionNumber(s.getAdmissionNumber());
        dto.setRollNumber(s.getRollNumber());
        dto.setClassId(s.getClassId());
        dto.setSectionId(s.getSectionId());
        dto.setAcademicYearId(s.getAcademicYearId());
        dto.setParentIds(s.getParentIds());
        dto.setDateOfBirth(s.getDateOfBirth());
        dto.setGender(s.getGender());
        dto.setBloodGroup(s.getBloodGroup());
        dto.setParentName(s.getParentName());
        dto.setParentPhone(s.getParentPhone());
        dto.setParentEmail(s.getParentEmail());
        dto.setSubjectIds(s.getSubjectIds());
        dto.setAcademicRecords(s.getAcademicRecords());
        dto.setCreatedAt(s.getCreatedAt());
        return dto;
    }
}
