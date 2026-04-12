package com.saas.school.modules.superadmin.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "super_admin_users")
public class SuperAdminUser {
    @Id
    private String userId;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;
    private String firstName;
    private String lastName;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private boolean isLocked = false;

    @Builder.Default
    private int failedLoginAttempts = 0;

    private Instant lastLoginAt;
    private String refreshToken;
    private Instant refreshTokenExpiresAt;

    @CreatedDate
    private Instant createdAt;
}
