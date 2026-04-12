package com.saas.school.modules.superadmin.dto;

import lombok.Data;

@Data
public class UpdateTenantRequest {
    private String schoolName;
    private String contactEmail;
    private String contactPhone;
    private String logoUrl;
    private AddressDto address;

    @Data
    public static class AddressDto {
        private String street, city, state, country, zip;
    }
}
