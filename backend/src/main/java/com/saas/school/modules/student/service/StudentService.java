package com.saas.school.modules.student.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StudentService {

    private final StudentRepository studentRepository;
    private final AuditService auditService;

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
            result = studentRepository.findAll(pageable);
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

        Student student = Student.builder()
                .studentId(UUID.randomUUID().toString())
                .userId(req.getUserId())
                .admissionNumber(req.getAdmissionNumber())
                .rollNumber(req.getRollNumber())
                .classId(req.getClassId())
                .sectionId(req.getSectionId())
                .academicYearId(req.getAcademicYearId())
                .parentIds(req.getParentIds())
                .dateOfBirth(req.getDateOfBirth())
                .gender(req.getGender())
                .bloodGroup(req.getBloodGroup())
                .address(mapAddress(req.getAddress()))
                .build();

        studentRepository.save(student);
        auditService.log("CREATE_STUDENT", "Student", student.getStudentId(),
                "Student created: " + student.getAdmissionNumber());
        return toDto(student);
    }

    public StudentDto updateStudent(String studentId, UpdateStudentRequest req) {
        Student s = findStudent(studentId);
        if (req.getRollNumber()    != null) s.setRollNumber(req.getRollNumber());
        if (req.getClassId()       != null) s.setClassId(req.getClassId());
        if (req.getSectionId()     != null) s.setSectionId(req.getSectionId());
        if (req.getBloodGroup()    != null) s.setBloodGroup(req.getBloodGroup());
        if (req.getAddress()       != null) s.setAddress(mapAddress(req.getAddress()));
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
            s.setClassId(req.getToClassId());
            s.setSectionId(req.getToSectionId());
            s.setAcademicYearId(req.getToAcademicYearId());
            studentRepository.save(s);
            promoted++;
        }

        auditService.log("BULK_PROMOTE", "Student", "bulk",
                "Promoted " + promoted + " students to class " + req.getToClassId());
        return new BulkPromoteResult(promoted, skipped);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Student findStudent(String studentId) {
        return studentRepository.findByStudentIdAndDeletedAtIsNull(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", studentId));
    }

    private Student.Address mapAddress(CreateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        return Student.Address.builder()
                .street(dto.getStreet()).city(dto.getCity())
                .state(dto.getState()).zip(dto.getZip()).build();
    }

    private Student.Address mapAddress(UpdateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        return Student.Address.builder()
                .street(dto.getStreet()).city(dto.getCity())
                .state(dto.getState()).zip(dto.getZip()).build();
    }

    public StudentDto toDto(Student s) {
        return StudentDto.builder()
                .studentId(s.getStudentId()).userId(s.getUserId())
                .admissionNumber(s.getAdmissionNumber()).rollNumber(s.getRollNumber())
                .classId(s.getClassId()).sectionId(s.getSectionId())
                .academicYearId(s.getAcademicYearId()).parentIds(s.getParentIds())
                .dateOfBirth(s.getDateOfBirth()).gender(s.getGender())
                .bloodGroup(s.getBloodGroup()).createdAt(s.getCreatedAt())
                .build();
    }
}
