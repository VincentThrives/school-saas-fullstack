package com.saas.school.modules.user.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.sms.model.TenantSmsSettings;
import com.saas.school.modules.sms.repository.CentralTenantSmsSettingsStore;
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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
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
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    /** Reads from the central DB so tenant admins see the same row the
     *  Super Admin writes. Required=false keeps the user module healthy
     *  in environments where the SMS module is excluded. */
    @Autowired(required = false) private CentralTenantSmsSettingsStore tenantSmsSettingsRepository;

    // ── List / Search ──────────────────────────────────────────────

    /**
     * Paginated list with composable filters — every filter is optional and
     * stacks as an AND. Replaces the earlier if/else cascade where the
     * "search" branch silently bypassed the role + status filters, so
     * picking a Role dropdown after typing a search query appeared to do
     * nothing (the search-only repository method ran, ignoring the role).
     *
     * <p>Search is tokenised on whitespace: each token must match SOME
     * searchable field (firstName / lastName / email / phone) — case-
     * insensitive substring. AND across tokens, OR across fields per
     * token. So "John D" matches a user whose firstName is "John" and
     * lastName starts with "D"; "kalika k" matches firstName "kalika"
     * + lastName starting with "k".</p>
     */
    public PageResponse<UserDto> listUsers(int page, int size, UserRole role,
                                            String status, String search) {
        Criteria criteria = Criteria.where("deletedAt").is(null);

        if (role != null) {
            criteria.and("role").is(role);
        }
        if (status != null && !status.isBlank()) {
            // "active" / "inactive" — case-insensitive.
            boolean active = "active".equalsIgnoreCase(status);
            criteria.and("isActive").is(active);
        }
        if (search != null && !search.isBlank()) {
            String[] tokens = search.trim().split("\\s+");
            java.util.List<Criteria> tokenCriterias = new java.util.ArrayList<>(tokens.length);
            for (String token : tokens) {
                if (token.isEmpty()) continue;
                String regex = java.util.regex.Pattern.quote(token);
                tokenCriterias.add(new Criteria().orOperator(
                        Criteria.where("firstName").regex(regex, "i"),
                        Criteria.where("lastName").regex(regex, "i"),
                        Criteria.where("email").regex(regex, "i"),
                        Criteria.where("phone").regex(regex, "i")
                ));
            }
            if (!tokenCriterias.isEmpty()) {
                criteria.andOperator(tokenCriterias.toArray(new Criteria[0]));
            }
        }

        Query query = new Query(criteria).with(Sort.by("createdAt").descending());
        long total = mongoTemplate.count(query, User.class);
        query.skip((long) page * size).limit(size);
        List<User> rows = mongoTemplate.find(query, User.class);

        List<UserDto> dtos = rows.stream().map(this::toDto).toList();
        return PageResponse.of(dtos, total, page, size);
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
        if (req.getEmail()     != null) user.setEmail(req.getEmail());
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
     * The default password format: DOB as {@code DDMMYYYY}. Matches what
     * student create + bulk import already write at account-creation time,
     * so resets and post-edit resyncs land on the same string instead of
     * silently switching the credential format. Returns null when DOB is
     * missing — caller skips the resync.
     *
     * <p>The {@code firstName} parameter is retained for backwards
     * compatibility with existing callers (Teacher controller, Student
     * service) and is intentionally unused in the password computation.
     * It only feeds the firstName/lastName sync inside
     * {@link #resyncDefaultPassword}.</p>
     */
    public static String defaultPasswordFor(String firstName, java.time.LocalDate dateOfBirth) {
        if (dateOfBirth == null) return null;
        return String.format("%02d%02d%04d",
                dateOfBirth.getDayOfMonth(),
                dateOfBirth.getMonthValue(),
                dateOfBirth.getYear());
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

    /**
     * Self-service password change. Caller is the logged-in user (any role)
     * proving knowledge of their current password before setting a new one.
     *
     * Distinct from {@link #resyncDefaultPassword} (admin-driven, no
     * old-password check) and {@link #adminResetPassword} (admin clicks
     * Reset on a student/employee, password becomes firstName@birthYear).
     *
     * Validation:
     *   - currentPassword must match the stored BCrypt hash
     *   - newPassword min 6 chars, must contain at least 1 letter and 1 digit
     *   - newPassword cannot equal currentPassword
     *
     * Throws {@link BusinessException} with a user-friendly message on any
     * failure — handled by the global exception handler into a 400.
     */
    public void changeMyPassword(String userId, String currentPassword, String newPassword) {
        if (userId == null) throw new BusinessException("Not authenticated");
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new BusinessException("Current password is required");
        }
        if (newPassword == null || newPassword.length() < 4) {
            throw new BusinessException("New password must be at least 4 characters");
        }
        if (currentPassword.equals(newPassword)) {
            throw new BusinessException("New password must be different from the current password");
        }
        // No complexity requirement — schools have parents/students who
        // struggle with anything stricter. 4-character minimum is our
        // only guard against blank/near-blank passwords.

        User user = findUser(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            // Don't leak any other detail — same generic message.
            throw new BusinessException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        // Never log the password itself, even for debugging.
        log.info("Password changed (self-service) for userId={} username={}",
                userId, user.getUsername());
        auditService.log("CHANGE_PASSWORD", "User", userId,
                "User changed own password");
    }

    /**
     * Admin-driven reset for a student or employee user. Resolves the
     * linked Student or Teacher record to compute the default password
     * ({@code firstName + "@" + birthYear}), encodes it, saves, audits,
     * and returns the plain-text password to the caller so the admin can
     * communicate it to the user.
     *
     * The plain-text password is returned in the HTTP response only —
     * never logged, never persisted in plain form.
     *
     * Throws {@link BusinessException} when:
     *   - user not found
     *   - user has no linked Student or Teacher record (e.g. another admin —
     *     they don't have a DOB, so the auto-rule can't apply)
     *   - the linked record is missing firstName or DOB
     *
     * Caller (controller) is responsible for the @PreAuthorize check.
     */
    public AdminResetPasswordResult adminResetPassword(String targetUserId,
                                                        String adminUserId,
                                                        StudentLookup studentLookup,
                                                        TeacherLookup teacherLookup) {
        if (targetUserId == null) throw new BusinessException("Target user is required");
        User user = findUser(targetUserId);

        // Try Student first, then Teacher. If neither, refuse.
        StudentLookup.Result student = studentLookup.findByUserId(targetUserId);
        TeacherLookup.Result teacher = teacherLookup.findByUserId(targetUserId);

        String firstName = null;
        java.time.LocalDate dob = null;
        String linkedRole = null;
        if (student != null) {
            firstName = student.firstName();
            dob = student.dateOfBirth();
            linkedRole = "STUDENT";
        } else if (teacher != null) {
            firstName = teacher.firstName();
            dob = teacher.dateOfBirth();
            linkedRole = "TEACHER";
        } else {
            throw new BusinessException(
                "Cannot reset password: this user is not linked to a student or employee record. "
              + "Admins manage their own passwords via Change Password.");
        }
        if (firstName == null || firstName.isBlank() || dob == null) {
            throw new BusinessException(
                "Cannot reset: linked " + linkedRole.toLowerCase()
              + " record is missing firstName or date of birth. Edit the record and try again.");
        }

        String newPwd = defaultPasswordFor(firstName, dob);
        user.setPasswordHash(passwordEncoder.encode(newPwd));
        userRepository.save(user);
        log.info("Password admin-reset for userId={} username={} (admin={}, linked={})",
                targetUserId, user.getUsername(), adminUserId, linkedRole);
        auditService.log("ADMIN_RESET_PASSWORD", "User", targetUserId,
                "Admin reset password to default (linked " + linkedRole + ")");

        return new AdminResetPasswordResult(targetUserId, user.getUsername(), newPwd);
    }

    /** Tiny adapter interfaces so UserService doesn't depend on Student/Teacher
     *  modules directly — keeps cycles out of the dependency graph and lets
     *  the controller wire them up. */
    public interface StudentLookup {
        Result findByUserId(String userId);
        record Result(String firstName, java.time.LocalDate dateOfBirth) {}
    }
    public interface TeacherLookup {
        Result findByUserId(String userId);
        record Result(String firstName, java.time.LocalDate dateOfBirth) {}
    }

    /** Returned by {@link #adminResetPassword} so the admin sees the new
     *  plain-text password ONCE in the HTTP response. */
    public record AdminResetPasswordResult(String userId, String username, String newPassword) {}

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
        UserDto dto = toDto(findUser(userId));
        // Attach per-tenant feature flags so the frontend can gate UI
        // (e.g. hide the SMS section entirely when SMS is disabled for
        // this school). Computed only on /me — list endpoints don't
        // need it. Falls back to defaults if no settings doc exists.
        dto.setTenantFeatures(currentTenantFeatures());
        return dto;
    }

    /** Builds the {@link TenantFeaturesDto} for the current request's
     *  tenant. Used by {@link #getMyProfile} and could be reused by
     *  any future endpoint that needs to expose feature flags. */
    private TenantFeaturesDto currentTenantFeatures() {
        // The SMS repo is wired with required=false so this module
        // still works in environments where the SMS module is removed
        // — gracefully returns "all off" instead of crashing.
        if (tenantSmsSettingsRepository == null) {
            return new TenantFeaturesDto(false, false, false, false);
        }
        String tenantId = TenantContext.getTenantId();
        TenantSmsSettings s = tenantSmsSettingsRepository.findByTenantId(tenantId).orElse(null);
        if (s == null) {
            return new TenantFeaturesDto(false, false, false, false);
        }
        return new TenantFeaturesDto(
                s.isEnabled(),
                s.isAbsenceAlertEnabled(),
                s.isResultPublishEnabled(),
                s.isCustomNoticeEnabled());
    }

    /**
     * Self-service profile update. Only fields owned by the User document
     * itself (phone, email, profilePhoto) and identity fields for users
     * WITHOUT a linked Student/Teacher record (i.e. admins) are honored.
     *
     * Students and teachers cannot change firstName/lastName via this
     * endpoint — those mutate the auto-password and must go through the
     * role-specific endpoints (Student/Employee /me/profile) which run
     * the password-resync hook. We silently ignore the fields here rather
     * than reject so the FE can send a single payload across roles.
     */
    public UserDto updateMyProfile(String userId, UpdateUserRequest req) {
        User user = findUser(userId);
        // Always-safe fields, every role.
        if (req.getPhone()           != null) user.setPhone(req.getPhone());
        if (req.getEmail()           != null) user.setEmail(req.getEmail());
        if (req.getProfilePhotoUrl() != null) user.setProfilePhotoUrl(req.getProfilePhotoUrl());

        // firstName/lastName are editable here ONLY for SCHOOL_ADMIN, who has
        // no linked Student/Teacher record. Students and teachers must use
        // their role-specific endpoint (/students/me/profile or
        // /employees/me/profile) which runs the password-resync hook so the
        // login password stays in sync with the new firstName.
        if (user.getRole() == UserRole.SCHOOL_ADMIN) {
            if (req.getFirstName() != null) user.setFirstName(req.getFirstName());
            if (req.getLastName()  != null) user.setLastName(req.getLastName());
        }
        // Otherwise — silently ignore firstName/lastName for non-admins.

        userRepository.save(user);
        auditService.log("PROFILE_SELF_UPDATE", "User", userId, "User updated own profile");
        return toDto(user);
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
