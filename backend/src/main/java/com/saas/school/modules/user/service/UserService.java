package com.saas.school.modules.user.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.user.dto.*;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;

    // ── List / Search ──────────────────────────────────────────────

    public PageResponse<UserDto> listUsers(int page, int size, UserRole role,
                                            String status, String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<User> result;

        boolean hasStatus = status != null && !status.isBlank();
        boolean hasRole = role != null;
        Boolean active = null;
        if (hasStatus) {
            // Accept "active"/"inactive" in any case
            active = "active".equalsIgnoreCase(status);
        }

        if (search != null && !search.isBlank()) {
            result = userRepository.searchByName(search, pageable);
        } else if (hasRole && hasStatus) {
            result = userRepository.findByRoleAndIsActive(role, active, pageable);
        } else if (hasRole) {
            result = userRepository.findByRoleAndDeletedAtIsNull(role, pageable);
        } else if (hasStatus) {
            // Status-only filter now works on its own (previously silently ignored).
            result = userRepository.findByIsActive(active, pageable);
        } else {
            result = userRepository.findByDeletedAtIsNull(pageable);
        }

        List<UserDto> dtos = result.getContent().stream().map(this::toDto).toList();
        return PageResponse.of(dtos, result.getTotalElements(), page, size);
    }

    public UserDto getUser(String userId) {
        return toDto(findUser(userId));
    }

    // ── Create / Update ────────────────────────────────────────────

    public UserDto createUser(CreateUserRequest req) {
        if (userRepository.existsByEmailAndDeletedAtIsNull(req.getEmail())) {
            throw new BusinessException("Email already in use: " + req.getEmail());
        }

        User user = new User();
        user.setUserId(UUID.randomUUID().toString());
        user.setTenantId(TenantContext.getTenantId());
        user.setEmail(req.getEmail());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole(req.getRole());
        user.setFirstName(req.getFirstName());
        user.setLastName(req.getLastName());
        user.setPhone(req.getPhone());
        user.setActive(true);
        user.setLocked(false);
        user.setFailedLoginAttempts(0);
        user.setCreatedAt(Instant.now());

        userRepository.save(user);
        auditService.log("CREATE_USER", "User", user.getUserId(),
                "Created user: " + user.getEmail() + " role: " + user.getRole());
        return toDto(user);
    }

    public UserDto updateUser(String userId, UpdateUserRequest req) {
        User user = findUser(userId);
        if (req.getFirstName() != null) user.setFirstName(req.getFirstName());
        if (req.getLastName()  != null) user.setLastName(req.getLastName());
        if (req.getPhone()     != null) user.setPhone(req.getPhone());
        if (req.getProfilePhotoUrl() != null) user.setProfilePhotoUrl(req.getProfilePhotoUrl());
        userRepository.save(user);
        auditService.log("UPDATE_USER", "User", userId, "User profile updated");
        return toDto(user);
    }

    public void setUserStatus(String userId, boolean active) {
        User user = findUser(userId);
        user.setActive(active);
        userRepository.save(user);
        auditService.log(active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
                "User", userId, "User status changed to: " + (active ? "ACTIVE" : "INACTIVE"));
    }

    public void unlockUser(String userId) {
        User user = findUser(userId);
        user.setLocked(false);
        user.setFailedLoginAttempts(0);
        user.setLockedAt(null);
        userRepository.save(user);
        auditService.log("UNLOCK_USER", "User", userId, "Account unlocked by admin");
    }

    public void softDeleteUser(String userId) {
        User user = findUser(userId);
        user.setDeletedAt(Instant.now());
        user.setActive(false);
        userRepository.save(user);
        auditService.log("DELETE_USER", "User", userId, "User soft deleted");
    }

    // ── Default-password sync (used by Student/Teacher update paths) ──

    /**
     * The auto-create password format: {@code firstName + "@" + birthYear}.
     * Returns null when either input is missing — caller skips the resync.
     */
    public static String defaultPasswordFor(String firstName, java.time.LocalDate dateOfBirth) {
        if (firstName == null || firstName.isBlank() || dateOfBirth == null) return null;
        return firstName + "@" + dateOfBirth.getYear();
    }

    /**
     * Re-encode the linked User's password using the auto-create rule and
     * keep the User's display firstName/lastName in sync.
     *
     * Called from {@code StudentService.updateStudent} and
     * {@code TeacherController.update} when the firstName or date-of-birth
     * fields have actually changed — so the credentials always match what
     * the admin sees on the profile page.
     *
     * Silent no-op when {@code userId} is unknown or the inputs are
     * insufficient (e.g. DOB unset).
     */
    public void resyncDefaultPassword(String userId, String firstName, String lastName,
                                      java.time.LocalDate dateOfBirth) {
        if (userId == null) {
            log.warn("resyncDefaultPassword skipped: userId is null (firstName={}, dob={})",
                    firstName, dateOfBirth);
            return;
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("resyncDefaultPassword skipped: no User found for userId={}", userId);
            return;
        }
        String pwd = defaultPasswordFor(firstName, dateOfBirth);
        if (pwd == null) {
            log.warn("resyncDefaultPassword skipped: insufficient inputs userId={} firstName={} dob={}",
                    userId, firstName, dateOfBirth);
            // Still keep firstName/lastName in sync if those are non-blank.
            if (firstName != null && !firstName.isBlank()) user.setFirstName(firstName);
            if (lastName  != null && !lastName.isBlank())  user.setLastName(lastName);
            userRepository.save(user);
            return;
        }
        user.setPasswordHash(passwordEncoder.encode(pwd));
        if (firstName != null && !firstName.isBlank()) user.setFirstName(firstName);
        if (lastName  != null && !lastName.isBlank())  user.setLastName(lastName);
        userRepository.save(user);
        // INFO log includes username + email so we can verify the right user
        // was hit (e.g. employeeId-based logins like "t1" vs the email path).
        log.info("Default password resynced for userId={} username={} email={} -> new password='{}'",
                userId, user.getUsername(), user.getEmail(), pwd);
        auditService.log("RESYNC_PASSWORD", "User", userId,
                "Default password regenerated after profile edit");
    }

    // ── Bulk Import ────────────────────────────────────────────────

    public BulkImportResult bulkImportUsers(MultipartFile file, UserRole role) throws IOException {
        List<String> errors = new ArrayList<>();
        List<UserDto> created = new ArrayList<>();
        int rowNum = 1;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);

            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue; // skip header
                rowNum = row.getRowNum() + 1;
                try {
                    CreateUserRequest req = new CreateUserRequest();
                    req.setFirstName(getCellValue(row, 0));
                    req.setLastName(getCellValue(row, 1));
                    req.setEmail(getCellValue(row, 2));
                    req.setPhone(getCellValue(row, 3));
                    req.setPassword(getCellValue(row, 4));
                    req.setRole(role);

                    if (req.getEmail() == null || req.getEmail().isBlank()) {
                        errors.add("Row " + rowNum + ": Email is required");
                        continue;
                    }

                    created.add(createUser(req));
                } catch (BusinessException e) {
                    errors.add("Row " + rowNum + ": " + e.getMessage());
                } catch (Exception e) {
                    errors.add("Row " + rowNum + ": Unexpected error - " + e.getMessage());
                }
            }
        }

        auditService.log("BULK_IMPORT_USERS", "User", "bulk",
                "Imported " + created.size() + " users, " + errors.size() + " errors");
        return new BulkImportResult(created.size(), errors.size(), errors);
    }

    // ── My Profile ────────────────────────────────────────────────

    public UserDto getMyProfile(String userId) {
        return toDto(findUser(userId));
    }

    public UserDto updateMyProfile(String userId, UpdateUserRequest req) {
        return updateUser(userId, req);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private User findUser(String userId) {
        return userRepository.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .or(() -> userRepository.findByUserIdAndDeletedAtIsNull(userId))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private String getCellValue(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default      -> null;
        };
    }

    public UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.setUserId(user.getUserId());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setPhone(user.getPhone());
        dto.setRole(user.getRole());
        dto.setActive(user.isActive());
        dto.setLocked(user.isLocked());
        dto.setProfilePhotoUrl(user.getProfilePhotoUrl());
        dto.setLastLoginAt(user.getLastLoginAt());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}
