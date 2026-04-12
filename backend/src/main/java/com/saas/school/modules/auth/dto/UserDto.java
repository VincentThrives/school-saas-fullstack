package com.saas.school.modules.auth.dto;
import com.saas.school.modules.user.model.UserRole;
import lombok.Builder;
import lombok.Data;
@Data @Builder
public class UserDto {
    private String userId, email, firstName, lastName, profilePhotoUrl;
    private UserRole role;
}
