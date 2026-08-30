package com.saas.school.modules.user.dto;

import com.saas.school.modules.user.model.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class CreateUserRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    private String phone;

    /**
     * Legacy single-role field — still required for backward
     * compatibility. When the admin picks multiple roles the frontend
     * sends BOTH: {@code role} = the first role in {@code roles}
     * (used as the initial {@code activeRole}) AND {@code roles} = the
     * full list. Old clients that only send {@code role} continue to
     * work — the server treats them as single-role users.
     */
    @NotNull
    private UserRole role;

    /**
     * Full role set for a multi-role user (Principal + HR, Teacher +
     * Class Teacher, etc.). Optional — if null / empty, the server
     * uses {@code [role]}. Must contain {@code role} if both are set.
     */
    private List<UserRole> roles;

    public CreateUserRequest() {
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public List<UserRole> getRoles() { return roles; }
    public void setRoles(List<UserRole> roles) { this.roles = roles; }
}
