package com.saas.school.modules.user.dto;
import lombok.Data;
@Data
public class UpdateUserRequest {
    private String firstName, lastName, phone, profilePhotoUrl;
}
