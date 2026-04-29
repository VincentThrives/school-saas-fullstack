package com.saas.school.modules.teacher.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "Employees")
@RestController
@RequestMapping("/api/v1/employees")
public class TeacherController {

    private static final Logger log = LoggerFactory.getLogger(TeacherController.class);

    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<Teacher>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Teacher> result = teacherRepo.findByDeletedAtIsNull(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(
                PageResponse.of(result.getContent(), result.getTotalElements(), page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Teacher>> get(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Employee not found"))));
    }

    /** The currently logged-in teacher's profile (used by My Classes / My Students). */
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('TEACHER','PRINCIPAL','SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> me(@AuthenticationPrincipal String userId) {
        Teacher t = teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No employee profile linked to this user"));
        return ResponseEntity.ok(ApiResponse.success(t));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> create(@RequestBody Teacher req) {
        try {
            // Reject duplicates up front. The DuplicateKeyException catch below
            // only fires when a Mongo unique index exists on employeeId — which
            // it doesn't in dev. This explicit check works regardless.
            if (req.getEmployeeId() == null || req.getEmployeeId().isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Employee ID is required"));
            }
            if (teacherRepo.existsByEmployeeIdAndDeletedAtIsNull(req.getEmployeeId())) {
                return ResponseEntity.badRequest().body(
                        ApiResponse.error("Employee ID '" + req.getEmployeeId() + "' is already in use"));
            }
            // DOB is required — the auto-generated User password is `firstName@<birthYear>`,
            // so an employee with no DOB cannot log in.
            if (req.getDateOfBirth() == null) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Date of birth is required"));
            }

            req.setTeacherId(UUID.randomUUID().toString());
            if (req.getEmployeeRole() == null || req.getEmployeeRole().isEmpty()) req.setEmployeeRole("TEACHER");
            req.syncFromAssignments();

            // Auto-create User account for login
            String userId = autoCreateUserForEmployee(req);
            if (userId != null) {
                req.setUserId(userId);
            }

            return ResponseEntity.ok(ApiResponse.success(teacherRepo.save(req), "Employee created"));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Employee ID already exists"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(ApiResponse.error("Failed to create employee: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Teacher>> update(
            @PathVariable String id, @RequestBody Teacher req) {
        Teacher existing = teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        if (req.getFirstName() != null) existing.setFirstName(req.getFirstName());
        if (req.getLastName() != null) existing.setLastName(req.getLastName());
        if (req.getPhone() != null) existing.setPhone(req.getPhone());
        if (req.getEmail() != null) existing.setEmail(req.getEmail());
        if (req.getQualification() != null) existing.setQualification(req.getQualification());
        if (req.getSpecialization() != null) existing.setSpecialization(req.getSpecialization());
        if (req.getEmployeeRole() != null) existing.setEmployeeRole(req.getEmployeeRole());
        if (req.getClassSubjectAssignments() != null) existing.setClassSubjectAssignments(req.getClassSubjectAssignments());
        if (req.getClassIds() != null) existing.setClassIds(req.getClassIds());
        if (req.getSubjectIds() != null) existing.setSubjectIds(req.getSubjectIds());
        existing.setClassTeacher(req.isClassTeacher());
        if (req.getClassTeacherOfClassId() != null) existing.setClassTeacherOfClassId(req.getClassTeacherOfClassId());
        if (req.getClassTeacherOfSectionId() != null) existing.setClassTeacherOfSectionId(req.getClassTeacherOfSectionId());
        if (req.getDateOfBirth() != null) existing.setDateOfBirth(req.getDateOfBirth());
        if (req.getJoiningDate() != null) existing.setJoiningDate(req.getJoiningDate());
        existing.syncFromAssignments();

        return ResponseEntity.ok(ApiResponse.success(teacherRepo.save(existing), "Employee updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        Teacher teacher = teacherRepo.findByTeacherIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        teacher.setDeletedAt(Instant.now());
        teacherRepo.save(teacher);
        return ResponseEntity.ok(ApiResponse.success(null, "Employee deleted"));
    }

    // ── Auto User Creation ─────────────────────────────────────────

    private String autoCreateUserForEmployee(Teacher employee) {
        try {
            String loginId = employee.getEmployeeId();
            String firstName = employee.getFirstName() != null ? employee.getFirstName() : "Employee";
            int birthYear = employee.getDateOfBirth() != null ? employee.getDateOfBirth().getYear() : 2000;
            String password = firstName + "@" + birthYear;

            // Map employee role to user role
            UserRole userRole = UserRole.TEACHER; // default
            if ("PRINCIPAL".equals(employee.getEmployeeRole())) {
                userRole = UserRole.PRINCIPAL;
            }

            String email = employee.getEmail() != null && !employee.getEmail().isEmpty()
                    ? employee.getEmail() : loginId + "@employee.school";
            if (userRepository.existsByEmailAndDeletedAtIsNull(email)) {
                log.warn("User with email {} already exists, skipping auto-create", email);
                return userRepository.findByEmailAndDeletedAtIsNull(email)
                        .map(User::getUserId).orElse(null);
            }

            User user = new User();
            user.setUserId(UUID.randomUUID().toString());
            user.setTenantId(TenantContext.getTenantId());
            user.setEmail(email);
            user.setUsername(loginId);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setRole(userRole);
            user.setFirstName(employee.getFirstName());
            user.setLastName(employee.getLastName());
            user.setPhone(employee.getPhone());
            user.setActive(true);
            user.setLocked(false);
            user.setFailedLoginAttempts(0);
            user.setCreatedAt(Instant.now());

            userRepository.save(user);
            log.info("Auto-created User for employee: loginId={}, password={}", loginId, password);
            return user.getUserId();
        } catch (Exception e) {
            log.error("Failed to auto-create User for employee: {}", e.getMessage());
            return null;
        }
    }
}
