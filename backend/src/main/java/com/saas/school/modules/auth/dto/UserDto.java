package com.saas.school.modules.auth.dto;

import com.saas.school.modules.user.model.UserRole;

import java.util.List;

public class UserDto {

    private String userId;
    private String email;
    private String firstName;
    private String lastName;
    private String profilePhotoUrl;
    /** Kept for backward compatibility with older clients — always
     *  equals {@link #activeRole}. New callers should read {@code activeRole}
     *  for the current hat and {@code roles} for the full set. */
    private UserRole role;
    /** Every role the user is authorised to switch to. Single-role
     *  users get a one-item list; multi-role users see multiple. */
    private List<UserRole> roles;
    /** The role the user is currently working AS. */
    private UserRole activeRole;

    public UserDto() {
    }

    public UserDto(String userId, String email, String firstName, String lastName, String profilePhotoUrl, UserRole role) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.profilePhotoUrl = profilePhotoUrl;
        this.role = role;
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
}
