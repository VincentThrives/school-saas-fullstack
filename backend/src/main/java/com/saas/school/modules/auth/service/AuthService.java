package com.saas.school.modules.auth.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.AccountLockedException;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.exception.TenantAccessException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.config.security.JwtUtil;
import com.saas.school.modules.auth.dto.*;
import com.saas.school.modules.auth.dto.SiblingStudentDto;
import com.saas.school.modules.superadmin.model.SuperAdminUser;
import com.saas.school.modules.superadmin.repository.SuperAdminUserRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    @Autowired private UserRepository userRepository;
    @Autowired private SuperAdminUserRepository superAdminUserRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private SchoolClassRepository classRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    @Autowired private JavaMailSender mailSender;

    /** Cap on sibling list length. Real families max out around 3-4;
     *  the cap is defence against a mis-entered {@code parentPhone}
     *  matching a large group of unrelated students. */
    private static final int MAX_SIBLINGS = 10;

    @Value("${app.jwt.refresh-token-expiry-ms:2592000000}")
    private long refreshTokenExpiryMs;

    // ── Tenant Login ───────────────────────────────────────────────

    public AuthResponse login(LoginRequest req) {
        // Look up tenant in CENTRAL DB first (no tenant context)
        TenantContext.clear();
        Tenant tenant = tenantRepository.findById(req.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));

        if (tenant.getStatus() == Tenant.TenantStatus.SUSPENDED) {
            throw new TenantAccessException("School account is suspended. Contact your administrator.");
        }
        if (tenant.getStatus() != Tenant.TenantStatus.ACTIVE) {
            throw new TenantAccessException("School account is inactive.");
        }

        // NOW route to the tenant DB for user lookup
        TenantContext.setTenantId(req.getTenantId());

        // Support login by email OR username, case-insensitive.
        // Student usernames are stored as lowercase first-name slugs ("varun"),
        // so we lowercase whatever the user typed before the lookup — "Varun",
        // "VARUN" and "varun" all resolve to the same account. Email is
        // already stored lowercase (StudentFieldNormalizer.lower) so the same
        // input transform works for both lookup paths.
        String typed = req.getUsername() == null ? "" : req.getUsername().trim().toLowerCase();
        if (typed.isEmpty()) {
            throw new BusinessException("Invalid credentials.");
        }

        // Exact match first — the common case for staff, teachers, and
        // students / parents who type their own full username.
        User exactMatch = userRepository.findByEmailAndDeletedAtIsNull(typed)
                .or(() -> userRepository.findByUsernameAndDeletedAtIsNull(typed))
                .orElse(null);

        User user = null;
        if (exactMatch != null) {
            if (exactMatch.getRole() == UserRole.SUPER_ADMIN) {
                throw new TenantAccessException("Use the Super Admin login endpoint.");
            }
            if (!exactMatch.isActive()) {
                throw new TenantAccessException("Account is deactivated. Contact your school admin.");
            }
            if (exactMatch.isLocked()) {
                throw new AccountLockedException("Account locked");
            }
            if (passwordEncoder.matches(req.getPassword(), exactMatch.getPasswordHash())) {
                user = exactMatch;
            }
        }

        // Smart-prefix fallback for the multi-child parent flow — when
        // the parent types just the phone number ("9945255052") and any
        // one child's password. The exact-match student ("9945255052")
        // owns the bare phone digits; siblings' usernames follow the
        // "phone + firstname-slug" pattern ("9945255052arun") which the
        // parent shouldn't have to memorise. If a phone-shaped input
        // failed the exact-match password check (or found no exact
        // match), sweep every user whose username starts with that
        // phone and try the submitted password against each. First
        // active + unlocked match wins.
        if (user == null && isPhoneShaped(typed)) {
            user = tryPrefixLogin(typed, req.getPassword(),
                    exactMatch != null ? exactMatch.getUserId() : null);
        }

        if (user == null) {
            // No candidate matched. Only tick the exact-match user's
            // failure counter — a wrong password shouldn't lock out
            // every sibling on the same phone. If there was no exact
            // match at all, don't tick anyone (nothing to attribute).
            if (exactMatch != null) {
                handleFailedAttempt(exactMatch, tenant);
            }
            throw new BusinessException("Invalid credentials.");
        }

        // Successful login — reset failed attempts
        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(Instant.now());

        String accessToken  = jwtUtil.generateAccessToken(
                user.getUserId(), req.getTenantId(), user.getRole(), tenant.getFeatureFlags());
        String refreshToken = jwtUtil.generateRefreshToken(
                user.getUserId(), req.getTenantId(), user.getRole());

        user.setRefreshToken(passwordEncoder.encode(refreshToken));
        user.setRefreshTokenExpiresAt(Instant.now().plusMillis(refreshTokenExpiryMs));
        userRepository.save(user);

        auditService.log("USER_LOGIN", "User", user.getUserId(), "Successful login");

        AuthResponse authResponse = new AuthResponse();
        authResponse.setAccessToken(accessToken);
        authResponse.setRefreshToken(refreshToken);
        authResponse.setRole(user.getRole());
        authResponse.setFeatureFlags(tenant.getFeatureFlags());
        authResponse.setUser(toUserDto(user));
        return authResponse;
    }

    // ── Super Admin Login ──────────────────────────────────────────

    public AuthResponse superAdminLogin(SuperAdminLoginRequest req) {
        SuperAdminUser admin = superAdminUserRepository.findByEmail(req.getUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials."));

        if (admin.isLocked()) {
            throw new AccountLockedException("Super admin account locked.");
        }

        if (!passwordEncoder.matches(req.getPassword(), admin.getPasswordHash())) {
            admin.setFailedLoginAttempts(admin.getFailedLoginAttempts() + 1);
            superAdminUserRepository.save(admin);
            throw new BusinessException("Invalid credentials.");
        }

        admin.setFailedLoginAttempts(0);
        admin.setLastLoginAt(Instant.now());

        // Super Admin JWT — NO tenantId
        String accessToken  = jwtUtil.generateAccessToken(admin.getUserId(), null, UserRole.SUPER_ADMIN, Map.of());
        String refreshToken = jwtUtil.generateRefreshToken(admin.getUserId(), null, UserRole.SUPER_ADMIN);

        admin.setRefreshToken(passwordEncoder.encode(refreshToken));
        admin.setRefreshTokenExpiresAt(Instant.now().plusMillis(refreshTokenExpiryMs));
        superAdminUserRepository.save(admin);

        auditService.log("SUPER_ADMIN_LOGIN", "SuperAdminUser", admin.getUserId(), "Super admin logged in");

        UserDto userDto = new UserDto();
        userDto.setUserId(admin.getUserId());
        userDto.setEmail(admin.getEmail());
        userDto.setFirstName(admin.getFirstName());
        userDto.setLastName(admin.getLastName());
        userDto.setRole(UserRole.SUPER_ADMIN);

        AuthResponse authResponse = new AuthResponse();
        authResponse.setAccessToken(accessToken);
        authResponse.setRefreshToken(refreshToken);
        authResponse.setRole(UserRole.SUPER_ADMIN);
        authResponse.setFeatureFlags(Map.of());
        authResponse.setUser(userDto);
        return authResponse;
    }

    // ── Token Refresh ──────────────────────────────────────────────

    public TokenRefreshResponse refreshToken(String refreshToken) {
        if (!jwtUtil.validateToken(refreshToken) || !jwtUtil.isRefreshToken(refreshToken)) {
            throw new BusinessException("Invalid or expired refresh token.");
        }

        String userId   = jwtUtil.getUserId(refreshToken);
        String tenantId = jwtUtil.getTenantId(refreshToken);
        String role     = jwtUtil.getRole(refreshToken);

        if (UserRole.SUPER_ADMIN.name().equals(role)) {
            SuperAdminUser admin = superAdminUserRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException("User not found."));
            if (!passwordEncoder.matches(refreshToken, admin.getRefreshToken())) {
                throw new BusinessException("Refresh token revoked.");
            }
            String newAccess  = jwtUtil.generateAccessToken(userId, null, UserRole.SUPER_ADMIN, Map.of());
            String newRefresh = jwtUtil.generateRefreshToken(userId, null, UserRole.SUPER_ADMIN);
            admin.setRefreshToken(passwordEncoder.encode(newRefresh));
            // Roll the audit clock forward — a user who keeps using the app
            // never crosses the idle threshold. Without this update the
            // metadata would still reflect the original login time, even
            // though the JWT itself is fresh.
            admin.setRefreshTokenExpiresAt(Instant.now().plusMillis(refreshTokenExpiryMs));
            superAdminUserRepository.save(admin);
            return new TokenRefreshResponse(newAccess, newRefresh);
        }

        // Look up tenant in CENTRAL DB first (no tenant context)
        TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new BusinessException("Tenant not found."));

        // NOW route to tenant DB for user lookup
        TenantContext.setTenantId(tenantId);
        User user = userRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new BusinessException("User not found."));

        if (!passwordEncoder.matches(refreshToken, user.getRefreshToken())) {
            throw new BusinessException("Refresh token revoked.");
        }

        String newAccess  = jwtUtil.generateAccessToken(userId, tenantId, user.getRole(), tenant.getFeatureFlags());
        String newRefresh = jwtUtil.generateRefreshToken(userId, tenantId, user.getRole());
        user.setRefreshToken(passwordEncoder.encode(newRefresh));
        // Rolling refresh window — every successful refresh resets the clock.
        // The JWT itself already carries a fresh expiry from generateRefreshToken;
        // we sync the User doc so admin audit screens reflect the same window.
        user.setRefreshTokenExpiresAt(Instant.now().plusMillis(refreshTokenExpiryMs));
        userRepository.save(user);

        return new TokenRefreshResponse(newAccess, newRefresh);
    }

    // ── Logout ─────────────────────────────────────────────────────

    public void logout(String userId, String tenantId) {
        if (tenantId != null) {
            TenantContext.setTenantId(tenantId);
            userRepository.findByUserIdAndDeletedAtIsNull(userId).ifPresent(u -> {
                u.setRefreshToken(null);
                u.setRefreshTokenExpiresAt(null);
                userRepository.save(u);
            });
        }
    }

    // ── Forgot / Reset Password ────────────────────────────────────

    public void forgotPassword(String email, String tenantId) {
        // Always return success — don't reveal if email exists
        TenantContext.setTenantId(tenantId);
        userRepository.findByEmailAndDeletedAtIsNull(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            // TODO: persist reset token with expiry in a password_reset_tokens collection
            sendPasswordResetEmail(email, token, tenantId);
        });
    }

    public void changePassword(String userId, String oldPassword, String newPassword) {
        User user = userRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
            throw new BusinessException("Current password is incorrect.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        userRepository.save(user);
        auditService.log("CHANGE_PASSWORD", "User", userId, "Password changed");
    }

    // ── Sibling switch (multi-child single-phone parent flow) ────

    /**
     * Every other student registered under the caller's
     * {@code parentPhone}, in the same tenant. Powers the header
     * "Switch student" widget so a parent whose phone is the login
     * for four children can hop between them without four logouts.
     *
     * <p>Returns an empty list when the caller is not a Student (staff,
     * admin, standalone parent account) or has no {@code parentPhone}
     * on file. Never surfaces the caller themselves in the list.</p>
     *
     * <p>Capped at {@link #MAX_SIBLINGS} entries — a mis-entered
     * phone matching a large group of unrelated students shouldn't
     * blow up the header menu.</p>
     */
    public List<SiblingStudentDto> getSiblings(String callerUserId) {
        if (callerUserId == null || callerUserId.isBlank()) return Collections.emptyList();

        Student caller = studentRepository.findByUserIdAndDeletedAtIsNull(callerUserId).orElse(null);
        if (caller == null) return Collections.emptyList();
        String parentPhone = caller.getParentPhone();
        if (parentPhone == null || parentPhone.isBlank()) return Collections.emptyList();

        List<Student> matches = studentRepository.findByParentPhoneAndDeletedAtIsNull(parentPhone);
        if (matches == null || matches.isEmpty()) return Collections.emptyList();

        List<Student> siblings = matches.stream()
                .filter(s -> s.getStudentId() != null
                        && !s.getStudentId().equals(caller.getStudentId()))
                .limit(MAX_SIBLINGS)
                .toList();
        if (siblings.isEmpty()) return Collections.emptyList();

        // Resolve className / sectionName in one batched lookup so we
        // don't hit Mongo per sibling. Class ids are typically <= 15
        // school-wide so this stays cheap even for tenants with many
        // classes.
        List<String> classIds = siblings.stream()
                .map(Student::getClassId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, SchoolClass> classById = new HashMap<>();
        if (!classIds.isEmpty()) {
            classRepository.findAllById(classIds).forEach(c -> classById.put(c.getClassId(), c));
        }

        List<SiblingStudentDto> out = new ArrayList<>(siblings.size());
        for (Student s : siblings) {
            String className = null;
            String sectionName = null;
            SchoolClass cls = classById.get(s.getClassId());
            if (cls != null) {
                className = cls.getName();
                if (cls.getSections() != null && s.getSectionId() != null) {
                    sectionName = cls.getSections().stream()
                            .filter(sec -> s.getSectionId().equals(sec.getSectionId()))
                            .map(SchoolClass.Section::getName)
                            .findFirst()
                            .orElse(null);
                }
            }
            out.add(new SiblingStudentDto(
                    s.getStudentId(),
                    s.getUserId(),
                    fullName(s),
                    s.getRollNumber(),
                    className,
                    sectionName));
        }
        return out;
    }

    /**
     * Swap the caller's session for the target student's session.
     *
     * <p>Validates: (1) caller resolves to a Student in this tenant,
     * (2) target studentId resolves to a Student in this tenant with a
     * live {@code userId}, (3) both share a non-blank {@code parentPhone}.
     * Any failure surfaces as {@link BusinessException} — the interceptor
     * on the client turns it into a "not allowed" toast.</p>
     *
     * <p>Password is never re-checked: proving parent-phone ownership at
     * the initial login is authorisation to walk between siblings.
     * Refresh tokens are freshly issued for the target user, and the
     * old caller's refresh token stays alive until it expires or the
     * caller explicitly logs out (matching how a normal login flow
     * behaves — no invalidation cascade).</p>
     */
    public AuthResponse switchToSibling(String callerUserId, String targetStudentId, String tenantId) {
        if (callerUserId == null || callerUserId.isBlank()
                || targetStudentId == null || targetStudentId.isBlank()) {
            throw new BusinessException("Invalid switch request.");
        }

        Student caller = studentRepository.findByUserIdAndDeletedAtIsNull(callerUserId)
                .orElseThrow(() -> new BusinessException("Only student accounts can switch."));
        Student target = studentRepository.findByStudentIdAndDeletedAtIsNull(targetStudentId)
                .orElseThrow(() -> new BusinessException("Sibling not found."));

        if (caller.getStudentId() != null && caller.getStudentId().equals(target.getStudentId())) {
            throw new BusinessException("Already signed in as this student.");
        }

        String callerPhone = caller.getParentPhone();
        String targetPhone = target.getParentPhone();
        if (callerPhone == null || callerPhone.isBlank()
                || !callerPhone.equals(targetPhone)) {
            throw new BusinessException("This student is not linked to your parent phone.");
        }

        String targetUserId = target.getUserId();
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new BusinessException("Sibling has no login account yet.");
        }
        User targetUser = userRepository.findByUserIdAndDeletedAtIsNull(targetUserId)
                .orElseThrow(() -> new BusinessException("Sibling account is inactive."));
        if (!targetUser.isActive()) {
            throw new BusinessException("Sibling account is deactivated.");
        }
        if (targetUser.isLocked()) {
            throw new BusinessException("Sibling account is locked.");
        }

        // Look up the tenant for feature flags on the new access token.
        // TenantContext is already scoped by the auth interceptor for the
        // caller's request; we still need the Tenant doc from the central DB.
        String effectiveTenantId = tenantId != null && !tenantId.isBlank()
                ? tenantId : TenantContext.getTenantId();
        Tenant tenant = null;
        if (effectiveTenantId != null) {
            String priorTenant = TenantContext.getTenantId();
            TenantContext.clear();
            try {
                tenant = tenantRepository.findById(effectiveTenantId).orElse(null);
            } finally {
                if (priorTenant != null) TenantContext.setTenantId(priorTenant);
            }
        }
        Map<String, Boolean> flags = tenant != null ? tenant.getFeatureFlags() : Map.of();

        String accessToken  = jwtUtil.generateAccessToken(
                targetUserId, effectiveTenantId, targetUser.getRole(), flags);
        String refreshToken = jwtUtil.generateRefreshToken(
                targetUserId, effectiveTenantId, targetUser.getRole());

        targetUser.setRefreshToken(passwordEncoder.encode(refreshToken));
        targetUser.setRefreshTokenExpiresAt(Instant.now().plusMillis(refreshTokenExpiryMs));
        targetUser.setLastLoginAt(Instant.now());
        userRepository.save(targetUser);

        auditService.log("STUDENT_SIBLING_SWITCH", "User", targetUserId,
                "Sibling switch from userId=" + callerUserId
                        + " to userId=" + targetUserId
                        + " parentPhone=" + callerPhone);

        AuthResponse resp = new AuthResponse();
        resp.setAccessToken(accessToken);
        resp.setRefreshToken(refreshToken);
        resp.setRole(targetUser.getRole());
        resp.setFeatureFlags(flags);
        resp.setUser(toUserDto(targetUser));
        return resp;
    }

    /** True when {@code typed} looks like a bare phone number — used
     *  as the gate for the sibling-prefix login fallback. Any input
     *  that is 10+ digits qualifies (Indian phones are 10 digits;
     *  admin can pad with country codes without breaking this). */
    private boolean isPhoneShaped(String typed) {
        if (typed == null || typed.length() < 10) return false;
        for (int i = 0; i < typed.length(); i++) {
            if (!Character.isDigit(typed.charAt(i))) return false;
        }
        return true;
    }

    /** Sweep every user whose username starts with {@code prefix} and
     *  return the first one whose password check passes AND account is
     *  active + unlocked. Skips the exact-match user if given (its
     *  password already failed, no point re-hashing). Caps the scan
     *  at 10 candidates so a common phone matching lots of unrelated
     *  usernames doesn't fan into a bcrypt-check DDoS on the login
     *  path. */
    private User tryPrefixLogin(String prefix, String password, String excludeUserId) {
        List<User> candidates = userRepository.findByUsernameStartingWithAndDeletedAtIsNull(prefix);
        if (candidates == null || candidates.isEmpty()) return null;
        int scanned = 0;
        for (User c : candidates) {
            if (scanned >= 10) break;
            if (c == null) continue;
            if (excludeUserId != null && excludeUserId.equals(c.getUserId())) continue;
            if (!c.isActive() || c.isLocked()) continue;
            if (c.getRole() == UserRole.SUPER_ADMIN) continue;
            scanned++;
            if (passwordEncoder.matches(password, c.getPasswordHash())) {
                return c;
            }
        }
        return null;
    }

    /** "First Last" — falls back to admissionNumber then studentId
     *  when either name field is blank (matches the display fallback
     *  used elsewhere in the app). */
    private String fullName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName().trim();
        String last = s.getLastName() == null ? "" : s.getLastName().trim();
        String joined = (first + " " + last).trim();
        if (!joined.isEmpty()) return joined;
        if (s.getAdmissionNumber() != null && !s.getAdmissionNumber().isBlank()) {
            return s.getAdmissionNumber();
        }
        return s.getStudentId();
    }

    // ── Helpers ────────────────────────────────────────────────────

    private void handleFailedAttempt(User user, Tenant tenant) {
        int maxAttempts = 5; // TODO: read from tenant settings
        user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
        if (user.getFailedLoginAttempts() >= maxAttempts) {
            user.setLocked(true);
            user.setLockedAt(Instant.now());
            auditService.log("ACCOUNT_LOCKED", "User", user.getUserId(),
                    "Account locked after " + maxAttempts + " failed attempts");
        }
        userRepository.save(user);
    }

    private void sendPasswordResetEmail(String email, String token, String tenantId) {
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setTo(email);
            mail.setSubject("Password Reset Request");
            mail.setText("Use this token to reset your password: " + token
                    + "\nToken expires in 30 minutes.");
            mailSender.send(mail);
        } catch (Exception e) {
            log.warn("Failed to send password reset email to {}: {}", email, e.getMessage());
        }
    }

    private UserDto toUserDto(User user) {
        UserDto dto = new UserDto();
        dto.setUserId(user.getUserId());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setRole(user.getRole());
        dto.setProfilePhotoUrl(user.getProfilePhotoUrl());
        return dto;
    }
}
