package com.saas.school.modules.user.dto;

import com.saas.school.modules.user.model.UserRole;

import java.time.Instant;

public class UserDto {

    private String userId;
    private String email;
    private String firstName;
    private String lastName;
    private String phone;
    private String profilePhotoUrl;
    private UserRole role;
    private boolean isActive;
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
}
