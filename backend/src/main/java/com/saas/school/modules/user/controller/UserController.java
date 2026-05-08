package com.saas.school.modules.user.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.dto.*;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Users")
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @Autowired private UserService userService;
    @Autowired private StudentRepository studentRepository;
    @Autowired private TeacherRepository teacherRepository;

    @Operation(summary = "Get current user profile")
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> getMyProfile(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getMyProfile(userId)));
    }

    @Operation(summary = "Update current user profile")
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> updateMyProfile(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody UpdateUserRequest req) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateMyProfile(userId, req)));
    }

    /**
     * Self-service password change. Any authenticated user (any role) can
     * rotate their own password by providing both the current and new value.
     * Validation lives in {@link UserService#changeMyPassword}; on a
     * BusinessException the global handler returns a 400 with the message.
     */
    @Operation(summary = "Change my password (any role)")
    @PostMapping("/me/change-password")
    public ResponseEntity<ApiResponse<Void>> changeMyPassword(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody ChangePasswordRequest req) {
        userService.changeMyPassword(userId, req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed"));
    }

    @Operation(summary = "List users (SCHOOL_ADMIN)")
    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PageResponse<UserDto>>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.success(
                userService.listUsers(page, size, role, status, search)));
    }

    @Operation(summary = "Get user by ID")
    @GetMapping("/{userId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<UserDto>> getUser(@PathVariable String userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUser(userId)));
    }

    @Operation(summary = "Create user (SCHOOL_ADMIN)")
    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<UserDto>> createUser(@Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(userService.createUser(req), "User created"));
    }

    @Operation(summary = "Update user")
    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserRequest req) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateUser(userId, req)));
    }

    /**
     * Admin override: reset a student/employee's password back to the
     * default rule (firstName + "@" + birthYear). The plaintext password
     * is returned in the HTTP response so the admin can copy and share
     * it with the user — it is never logged or persisted.
     *
     * Per Phase-2 plan, this only works for users linked to a Student or
     * Teacher record (the rule needs a DOB). Other admins must use the
     * self-service Change Password flow.
     *
     * Adapters: StudentLookup and TeacherLookup are wired here as inline
     * lambdas so UserService stays free of student/teacher imports (no
     * dependency cycle between user ↔ student/teacher modules).
     */
    @Operation(summary = "Admin reset password to default (SCHOOL_ADMIN)")
    @PostMapping("/{userId}/admin-reset-password")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<UserService.AdminResetPasswordResult>> adminResetPassword(
            @PathVariable String userId,
            @AuthenticationPrincipal String adminUserId) {
        UserService.StudentLookup studentLookup = id -> studentRepository
                .findByUserIdAndDeletedAtIsNull(id)
                .map(s -> new UserService.StudentLookup.Result(s.getFirstName(), s.getDateOfBirth()))
                .orElse(null);
        UserService.TeacherLookup teacherLookup = id -> teacherRepository
                .findByUserIdAndDeletedAtIsNull(id)
                .map(t -> new UserService.TeacherLookup.Result(t.getFirstName(), t.getDateOfBirth()))
                .orElse(null);

        UserService.AdminResetPasswordResult result = userService.adminResetPassword(
                userId, adminUserId, studentLookup, teacherLookup);
        return ResponseEntity.ok(ApiResponse.success(result, "Password reset"));
    }

    @Operation(summary = "Activate / deactivate user")
    @PatchMapping("/{userId}/status")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> setStatus(
            @PathVariable String userId,
            @RequestParam boolean active) {
        userService.setUserStatus(userId, active);
        return ResponseEntity.ok(ApiResponse.success(null, "Status updated"));
    }

    @Operation(summary = "Unlock locked account")
    @PatchMapping("/{userId}/unlock")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> unlockUser(@PathVariable String userId) {
        userService.unlockUser(userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Account unlocked"));
    }

    @Operation(summary = "Soft delete user")
    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable String userId) {
        userService.softDeleteUser(userId);
        return ResponseEntity.ok(ApiResponse.success(null, "User deleted"));
    }

    @Operation(summary = "Bulk import users from Excel/CSV")
    @PostMapping(value = "/bulk-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<BulkImportResult>> bulkImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam UserRole role) throws Exception {
        return ResponseEntity.ok(ApiResponse.success(
                userService.bulkImportUsers(file, role), "Bulk import completed"));
    }
}
