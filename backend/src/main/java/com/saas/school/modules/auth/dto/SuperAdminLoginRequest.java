package com.saas.school.modules.auth.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class SuperAdminLoginRequest {
    @NotBlank private String username;
    @NotBlank private String password;
}
