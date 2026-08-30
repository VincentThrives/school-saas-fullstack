package com.saas.school.modules.user.dto;

import com.saas.school.modules.user.model.UserRole;

import java.util.List;

public class UpdateUserRequest {

    private String firstName;
    private String lastName;
    private String phone;
    private String profilePhotoUrl;
    private String email;

    /**
     * Multi-role update. Optional — null means "leave roles as they are".
     * When present, replaces the user's role set entirely; the server
     * clamps {@code activeRole} to the first entry if the current one is
     * no longer in the list, so a Principal-turned-into-only-HR loses
     * their Principal hat automatically.
     */
    private List<UserRole> roles;

    public UpdateUserRequest() {
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public List<UserRole> getRoles() { return roles; }
    public void setRoles(List<UserRole> roles) { this.roles = roles; }
}
