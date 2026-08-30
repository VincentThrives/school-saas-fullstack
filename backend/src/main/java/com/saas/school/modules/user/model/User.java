package com.saas.school.modules.user.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_email", def = "{'tenantId': 1, 'email': 1}", unique = true)
})
public class User {
    @Id
    private String userId;
    private String tenantId;
    private String email;
    private String username;
    private String passwordHash;

    /**
     * Legacy single-role field — kept for backward compatibility with
     * every existing read path (reports, exports, admin views) that
     * still calls {@link #getRole()}. Always mirrors {@link #activeRole}
     * on write via {@link #normalizeRoles()}. Old docs without
     * {@link #roles} still read fine — {@link #normalizeRoles()} back-
     * fills the array from this field on load.
     */
    private UserRole role;

    /**
     * All roles this user is authorised to work as. Added when we
     * introduced multi-role support (e.g. Principal who also runs HR).
     * Null / empty on legacy docs — {@link #normalizeRoles()} seeds
     * this from the single {@link #role} field so old data behaves
     * identically to a single-role user.
     */
    private List<UserRole> roles;

    /**
     * The role the user is currently working AS. Drives sidebar,
     * authorization checks, and JWT authorities. Defaults to
     * {@link #role} on old docs (single-role users always end up here).
     * Persisted so re-login keeps the same hat the user was wearing.
     */
    private UserRole activeRole;

    private String firstName;
    private String lastName;
    private String phone;
    private String profilePhotoUrl;
    private boolean isActive = true;
    private boolean isLocked = false;
    private int failedLoginAttempts = 0;
    private Instant lastLoginAt;
    private Instant passwordChangedAt;
    private Instant lockedAt;
    private String refreshToken;
    private Instant refreshTokenExpiresAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant deletedAt;

    // ── Constructors ──────────────────────────────────────────────

    public User() {
    }

    public User(String userId, String tenantId, String email, String passwordHash, UserRole role,
                String firstName, String lastName, String phone, String profilePhotoUrl,
                boolean isActive, boolean isLocked, int failedLoginAttempts, Instant lastLoginAt,
                Instant passwordChangedAt, Instant lockedAt, String refreshToken,
                Instant refreshTokenExpiresAt, Instant createdAt, Instant updatedAt, Instant deletedAt) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.profilePhotoUrl = profilePhotoUrl;
        this.isActive = isActive;
        this.isLocked = isLocked;
        this.failedLoginAttempts = failedLoginAttempts;
        this.lastLoginAt = lastLoginAt;
        this.passwordChangedAt = passwordChangedAt;
        this.lockedAt = lockedAt;
        this.refreshToken = refreshToken;
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deletedAt = deletedAt;
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public List<UserRole> getRoles() {
        return roles;
    }

    public void setRoles(List<UserRole> roles) {
        this.roles = roles;
    }

    public UserRole getActiveRole() {
        return activeRole;
    }

    public void setActiveRole(UserRole activeRole) {
        this.activeRole = activeRole;
    }

    /**
     * Idempotent sync between the singular {@link #role} field and the
     * multi-role {@link #roles} + {@link #activeRole} fields. Called
     * from {@code UserService.save()} before every persist so:
     *
     * <ul>
     *   <li>Old code paths reading {@code getRole()} always see a
     *       non-null value.</li>
     *   <li>Old MongoDB docs without {@code roles} get the array back-
     *       filled from {@code role} on first save.</li>
     *   <li>{@code activeRole} defaults to the first entry in
     *       {@code roles} when the caller didn't pick one.</li>
     *   <li>{@code role} tracks {@code activeRole} so single-role
     *       queries continue to work.</li>
     * </ul>
     *
     * <p>Never throws — a User that arrives with neither {@code role}
     * nor {@code roles} set is left as-is (caller validation catches
     * that upstream).</p>
     */
    public void normalizeRoles() {
        // Backfill the array from the singular field (legacy docs, or
        // callers that only set setRole).
        if ((roles == null || roles.isEmpty()) && role != null) {
            roles = new ArrayList<>();
            roles.add(role);
        }
        // Default active role → first in the array. Picking the first
        // matches the "primary role" intent: whichever the admin listed
        // first is what the user sees on next login.
        if (activeRole == null && roles != null && !roles.isEmpty()) {
            activeRole = roles.get(0);
        }
        // Keep the singular field pointed at activeRole so
        // getRole()-based code paths (reports, dropdowns, filters)
        // reflect the current hat.
        if (activeRole != null) {
            role = activeRole;
        }
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getProfilePhotoUrl() {
        return profilePhotoUrl;
    }

    public void setProfilePhotoUrl(String profilePhotoUrl) {
        this.profilePhotoUrl = profilePhotoUrl;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public boolean isLocked() {
        return isLocked;
    }

    public void setLocked(boolean locked) {
        isLocked = locked;
    }

    public int getFailedLoginAttempts() {
        return failedLoginAttempts;
    }

    public void setFailedLoginAttempts(int failedLoginAttempts) {
        this.failedLoginAttempts = failedLoginAttempts;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }

    public void setPasswordChangedAt(Instant passwordChangedAt) {
        this.passwordChangedAt = passwordChangedAt;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public void setLockedAt(Instant lockedAt) {
        this.lockedAt = lockedAt;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public Instant getRefreshTokenExpiresAt() {
        return refreshTokenExpiresAt;
    }

    public void setRefreshTokenExpiresAt(Instant refreshTokenExpiresAt) {
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }
}
