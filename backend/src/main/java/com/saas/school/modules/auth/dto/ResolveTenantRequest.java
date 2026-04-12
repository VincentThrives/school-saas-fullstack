package com.saas.school.modules.auth.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class ResolveTenantRequest {
    @NotBlank private String schoolId;
}
