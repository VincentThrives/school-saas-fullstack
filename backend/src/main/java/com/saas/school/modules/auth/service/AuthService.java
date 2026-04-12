package com.saas.school.modules.auth.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.AccountLockedException;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.exception.TenantAccessException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.config.security.JwtUtil;
import com.saas.school.modules.auth.dto.*;
import com.saas.school.modules.superadmin.model.SuperAdminUser;
import com.saas.school.modules.superadmin.repository.SuperAdminUserRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
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
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    @Autowired private UserRepository userRepository;
    @Autowired private SuperAdminUserRepository superAdminUserRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    @Autowired private JavaMailSender mailSender;

    @Value("${app.jwt.refresh-token-expiry-ms:604800000}")
    private long refreshTokenExpiryMs;

    // ── Tenant Login ───────────────────────────────────────────────

    public AuthResponse login(LoginRequest req) {
        // Route to the correct tenant DB
        TenantContext.setTenantId(req.getTenantId());

        Tenant tenant = tenantRepository.findById(req.getTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found"));

        if (tenant.getStatus() == Tenant.TenantStatus.SUSPENDED) {
            throw new TenantAccessException("School account is suspended. Contact your administrator.");
        }
        if (tenant.getStatus() != Tenant.TenantStatus.ACTIVE) {
            throw new TenantAccessException("School account is inactive.");
        }

        User user = userRepository.findByEmailAndDeletedAtIsNull(req.getUsername())
                .orElseThrow(() -> new BusinessException("Invalid credentials."));

        if (user.getRole() == UserRole.SUPER_ADMIN) {
            throw new TenantAccessException("Use the Super Admin login endpoint.");
        }
        if (!user.isActive()) {
            throw new TenantAccessException("Account is deactivated. Contact your school admin.");
        }
        if (user.isLocked()) {
            throw new AccountLockedException("Account locked");
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            handleFailedAttempt(user, tenant);
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
            superAdminUserRepository.save(admin);
            return new TokenRefreshResponse(newAccess, newRefresh);
        }

        TenantContext.setTenantId(tenantId);
        User user = userRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new BusinessException("User not found."));

        if (!passwordEncoder.matches(refreshToken, user.getRefreshToken())) {
            throw new BusinessException("Refresh token revoked.");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new BusinessException("Tenant not found."));

        String newAccess  = jwtUtil.generateAccessToken(userId, tenantId, user.getRole(), tenant.getFeatureFlags());
        String newRefresh = jwtUtil.generateRefreshToken(userId, tenantId, user.getRole());
        user.setRefreshToken(passwordEncoder.encode(newRefresh));
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
