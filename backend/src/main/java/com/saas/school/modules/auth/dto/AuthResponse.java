package com.saas.school.modules.auth.dto;
import com.saas.school.modules.user.model.UserRole;
import lombok.Builder;
import lombok.Data;
import java.util.Map;
@Data @Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private UserRole role;
    private Map<String, Boolean> featureFlags;
    private UserDto user;
}
