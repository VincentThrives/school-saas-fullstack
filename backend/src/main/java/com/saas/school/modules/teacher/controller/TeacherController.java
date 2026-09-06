package com.saas.school.modules.teacher.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.teacher.dto.EmployeeImportResult;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.service.EmployeeImportService;
import com.saas.school.modules.teacher.service.EmployeeUserProvisioningService;
import com.saas.school.modules.user.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.UUID;

@Tag(name = "Employees")
@RestController
@RequestMapping("/api/v1/employees")
public class TeacherController {

    private static final Logger log = LoggerFactory.getLogger(TeacherController.class);

    @Autowired private TeacherRepository teacherRepo;
    @Autowired private UserService userService;
    @Autowired private EmployeeUserProvisioningService userProvisioning;
    @Autowired private EmployeeImportService employeeImportService;

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

    /** Self-service profile update for an EMPLOYEE. Whitelisted to phone,
     *  email, qualification, specialization, and address — identity fields
     *  (name, DOB, employeeId, role, joining date, class assignments) stay
     *  admin-controlled. */
    @PutMapping("/me/profile")
    @PreAuthorize("hasAnyRole('TEACHER','PRINCIPAL')")
    public ResponseEntity<ApiResponse<Teacher>> updateMyProfile(
            @AuthenticationPrincipal String userId,
            @RequestBody com.saas.school.modules.teacher.dto.EmployeeSelfUpdateRequest req) {
        Teacher t = teacherRepo.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No employee profile linked to this user"));
        if (req.getPhone()          != null) t.setPhone(req.getPhone());
        if (req.getEmail()          != null) t.setEmail(req.getEmail());
        if (req.getQualification()  != null) t.setQualification(req.getQualification());
        if (req.getSpecialization() != null) t.setSpecialization(req.getSpecialization());
        if (req.getAddress()        != null) {
            Teacher.Address a = new Teacher.Address();
            a.setStreet(req.getAddress().getStreet());
            a.setCity(req.getAddress().getCity());
            a.setState(req.getAddress().getState());
            a.setCountry(req.getAddress().getCountry());
            a.setZip(req.getAddress().getZip());
            t.setAddress(a);
        }
        Teacher saved = teacherRepo.save(t);
        return ResponseEntity.ok(ApiResponse.success(saved, "Profile updated"));
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

            // Auto-create User account for login — same helper the bulk-import
            // path uses so the two entry points can't drift on password rules.
            String userId = userProvisioning.provision(req);
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

        // Snapshot the OLD identity fields BEFORE the patch so we can detect
        // a real change and resync the linked User's default password
        // (firstName + "@" + birthYear) below.
        String oldFirstName = existing.getFirstName();
        java.time.LocalDate oldDob = existing.getDateOfBirth();

        if (req.getFirstName() != null) existing.setFirstName(req.getFirstName());
        if (req.getLastName() != null) existing.setLastName(req.getLastName());
        if (req.getPhone() != null) existing.setPhone(req.getPhone());
        if (req.getEmail() != null) existing.setEmail(req.getEmail());
        if (req.getQualification() != null) existing.setQualification(req.getQualification());
        if (req.getSpecialization() != null) existing.setSpecialization(req.getSpecialization());
        if (req.getEmployeeRole() != null) existing.setEmployeeRole(req.getEmployeeRole());
        // Multi-role additions: the frontend sends the full desired
        // list on every edit (empty array means "no additional roles").
        // Detect that by checking != null so a submit without the field
        // (e.g. legacy client) leaves the existing list alone.
        boolean rolesChanged = req.getAdditionalRoles() != null
                && !java.util.Objects.equals(existing.getAdditionalRoles(), req.getAdditionalRoles());
        if (req.getAdditionalRoles() != null) existing.setAdditionalRoles(req.getAdditionalRoles());
        if (req.getClassSubjectAssignments() != null) existing.setClassSubjectAssignments(req.getClassSubjectAssignments());
        if (req.getClassIds() != null) existing.setClassIds(req.getClassIds());
        if (req.getSubjectIds() != null) existing.setSubjectIds(req.getSubjectIds());
        existing.setClassTeacher(req.isClassTeacher());
        if (req.getClassTeacherOfClassId() != null) existing.setClassTeacherOfClassId(req.getClassTeacherOfClassId());
        if (req.getClassTeacherOfSectionId() != null) existing.setClassTeacherOfSectionId(req.getClassTeacherOfSectionId());
        if (req.getDateOfBirth() != null) existing.setDateOfBirth(req.getDateOfBirth());
        if (req.getJoiningDate() != null) existing.setJoiningDate(req.getJoiningDate());
        existing.syncFromAssignments();

        Teacher saved = teacherRepo.save(existing);

        // If firstName or DOB actually changed, regenerate the linked User's
        // default password so credentials stay aligned with the profile.
        boolean firstNameChanged = !java.util.Objects.equals(oldFirstName, saved.getFirstName());
        boolean dobChanged = !java.util.Objects.equals(oldDob, saved.getDateOfBirth());
        if (saved.getUserId() != null && (firstNameChanged || dobChanged)) {
            userService.resyncDefaultPassword(saved.getUserId(), saved.getFirstName(),
                    saved.getLastName(), saved.getDateOfBirth());
        }
        // Push the merged (primary + additional) role list onto the
        // linked User whenever either input changed. Silent no-op if
        // no linked user exists.
        if (rolesChanged || (saved.getUserId() != null
                && req.getEmployeeRole() != null
                && !java.util.Objects.equals(existing.getEmployeeRole(), req.getEmployeeRole()))) {
            userProvisioning.resyncLinkedUserRoles(saved);
        }

        return ResponseEntity.ok(ApiResponse.success(saved, "Employee updated"));
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

    // (Auto User creation moved to EmployeeUserProvisioningService so
    //  bulk-import shares the exact same login/password rules.)

    // ── Bulk import (Excel) ──────────────────────────────────────────

    /**
     * Download the .xlsx import template — header row + sample row + an
     * Instructions tab with column guidance and valid role values. Admin
     * fills it and re-uploads via /import.
     */
    @GetMapping("/import/template")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ByteArrayResource> downloadImportTemplate() {
        byte[] bytes = employeeImportService.buildTemplate();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"employees-import-template.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    /**
     * Bulk-create employees from the filled template. All-or-nothing —
     * any row that fails validation returns 400 with a row-by-row error
     * report (handled by GlobalExceptionHandler) and nothing is saved.
     */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<EmployeeImportResult>> importEmployees(
            @RequestPart("file") MultipartFile file) {
        EmployeeImportResult result = employeeImportService.importFromExcel(file);
        return ResponseEntity.ok(ApiResponse.success(
                result, "Imported " + result.getCreated() + " employees"));
    }
}
