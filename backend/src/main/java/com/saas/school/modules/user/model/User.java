package com.saas.school.modules.user.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "tenant_email", def = "{'tenantId': 1, 'email': 1}", unique = true)
})
public class User {
    @Id
    private String userId;
    private String tenantId;
    private String email;
    private String passwordHash;
    private UserRole role;
    private String firstName;
    private String lastName;
    private String phone;
    private String profilePhotoUrl;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private boolean isLocked = false;

    @Builder.Default
    private int failedLoginAttempts = 0;

    private Instant lastLoginAt;
    private Instant passwordChangedAt;
    private Instant lockedAt;
    private String refreshToken;            // stored hashed for revocation
    private Instant refreshTokenExpiresAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant deletedAt;  // soft delete
}
