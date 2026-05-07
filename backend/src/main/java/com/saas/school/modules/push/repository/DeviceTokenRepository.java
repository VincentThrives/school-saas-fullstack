package com.saas.school.modules.push.repository;

import com.saas.school.modules.push.model.DeviceToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceTokenRepository extends MongoRepository<DeviceToken, String> {

    /** All tokens registered for a user (one user may have multiple devices). */
    List<DeviceToken> findByUserId(String userId);

    /** Token-based lookup — used to upsert on register and delete on logout. */
    Optional<DeviceToken> findByToken(String token);

    void deleteByToken(String token);
}
