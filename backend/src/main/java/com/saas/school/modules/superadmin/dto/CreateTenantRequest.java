package com.saas.school.modules.superadmin.dto;

import com.saas.school.modules.tenant.model.Tenant.SubscriptionPlan;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTenantRequest {
    @NotBlank private String schoolName;
    @NotBlank private String subdomain;
    @Email @NotBlank private String contactEmail;
    private String contactPhone;
    @NotNull private SubscriptionPlan plan;
    private String logoUrl;
    private AddressDto address;

    // Initial SCHOOL_ADMIN account
    @Email @NotBlank private String adminEmail;
    @NotBlank private String adminPassword;
    @NotBlank private String adminFirstName;
    @NotBlank private String adminLastName;

    @Data
    public static class AddressDto {
        private String street, city, state, country, zip;
    }
}
