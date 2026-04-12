package com.saas.school.modules.user.dto;
import com.saas.school.modules.user.model.UserRole;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
@Data @Builder
public class UserDto {
    private String userId, email, firstName, lastName, phone, profilePhotoUrl;
    private UserRole role;
    private boolean isActive, isLocked;
    private Instant lastLoginAt, createdAt;
}
