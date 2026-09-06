package com.saas.school.modules.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.saas.school.modules.user.model.UserRole;

import java.time.Instant;
import java.util.List;

public class UserDto {

    private String userId;
    private String email;
    private String username;
    private String firstName;
    private String lastName;
    private String phone;
    private String profilePhotoUrl;
    /** Kept for backward compatibility — always equal to {@link #activeRole}. */
    private UserRole role;
    /** Every role the user is authorised to switch to. */
    private List<UserRole> roles;
    /** Which role the user is currently working AS. */
    private UserRole activeRole;

    /**
     * Per-tenant feature flags — drives the frontend's UI gating.
     * Set only on {@code /users/me} responses (not on list endpoints)
     * so the calling user's own tenant feature state is known at
     * login + page-load time.
     *
     * Currently carries SMS toggles; will grow as more tenant-gated
     * features land (WhatsApp, advanced analytics, etc.).
     */
    private TenantFeaturesDto tenantFeatures;

    // Force JSON key "isActive" / "isLocked" — Jackson would otherwise strip the "is" prefix
    // when it sees the matching getter (isActive()), breaking the Angular UI that expects
    // user.isActive / user.isLocked.
    @JsonProperty("isActive")
    private boolean isActive;
    @JsonProperty("isLocked")
    private boolean isLocked;
    private Instant lastLoginAt;
    private Instant createdAt;

    public UserDto() {
    }

    public UserDto(String userId, String email, String firstName, String lastName, String phone,
                   String profilePhotoUrl, UserRole role, boolean isActive, boolean isLocked,
                   Instant lastLoginAt, Instant createdAt) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.profilePhotoUrl = profilePhotoUrl;
        this.role = role;
        this.isActive = isActive;
        this.isLocked = isLocked;
        this.lastLoginAt = lastLoginAt;
        this.createdAt = createdAt;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
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

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public List<UserRole> getRoles() { return roles; }
    public void setRoles(List<UserRole> roles) { this.roles = roles; }

    public UserRole getActiveRole() { return activeRole; }
    public void setActiveRole(UserRole activeRole) { this.activeRole = activeRole; }

    @JsonProperty("isActive")
    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    @JsonProperty("isLocked")
    public boolean isLocked() {
        return isLocked;
    }

    public void setLocked(boolean locked) {
        isLocked = locked;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public TenantFeaturesDto getTenantFeatures() { return tenantFeatures; }
    public void setTenantFeatures(TenantFeaturesDto tenantFeatures) { this.tenantFeatures = tenantFeatures; }
}
