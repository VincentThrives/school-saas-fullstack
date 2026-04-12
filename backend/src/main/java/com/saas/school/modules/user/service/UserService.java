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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    // ── List / Search ──────────────────────────────────────────────

    public PageResponse<UserDto> listUsers(int page, int size, UserRole role,
                                            String status, String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<User> result;

        if (search != null && !search.isBlank()) {
            result = userRepository.searchByName(search, pageable);
        } else if (role != null && status != null) {
            boolean active = "active".equalsIgnoreCase(status);
            result = userRepository.findByRoleAndIsActive(role, active, pageable);
        } else if (role != null) {
            result = userRepository.findByRoleAndDeletedAtIsNull(role, pageable);
        } else {
            result = userRepository.findAll(pageable);
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

        User user = User.builder()
                .userId(UUID.randomUUID().toString())
                .tenantId(TenantContext.getTenantId())
                .email(req.getEmail())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .role(req.getRole())
                .firstName(req.getFirstName())
                .lastName(req.getLastName())
                .phone(req.getPhone())
                .isActive(true)
                .isLocked(false)
                .failedLoginAttempts(0)
                .createdAt(Instant.now())
                .build();

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
        return userRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
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
        return UserDto.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .role(user.getRole())
                .isActive(user.isActive())
                .isLocked(user.isLocked())
                .profilePhotoUrl(user.getProfilePhotoUrl())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
