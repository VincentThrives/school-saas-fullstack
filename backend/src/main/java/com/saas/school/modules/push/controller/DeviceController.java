package com.saas.school.modules.push.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.push.dto.RegisterDeviceRequest;
import com.saas.school.modules.push.model.DeviceToken;
import com.saas.school.modules.push.repository.DeviceTokenRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

/**
 * Endpoints for registering / removing FCM device tokens.
 *
 * Both routes are authenticated — the userId comes from the JWT, never
 * from the request body. A logged-in user can only manage their own
 * tokens, by definition of {@link AuthenticationPrincipal}.
 *
 * Register is upsert-style: if the same token is sent again (e.g. user
 * logs out + back in on the same device), we update the existing row
 * with the new userId rather than creating a duplicate. This handles
 * the "shared family device" case correctly.
 */
@Tag(name = "Devices")
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceController {

    private static final Logger log = LoggerFactory.getLogger(DeviceController.class);

    @Autowired
    private DeviceTokenRepository tokenRepository;

    /** Called by the mobile app after login to subscribe this device to pushes. */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Void>> register(
            @AuthenticationPrincipal String userId,
            @RequestBody RegisterDeviceRequest req) {
        if (userId == null || req.getToken() == null || req.getToken().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing token or user"));
        }

        // Upsert by token: same physical device that re-registers (e.g. on
        // logout/login) overwrites the previous owner.
        DeviceToken existing = tokenRepository.findByToken(req.getToken()).orElse(null);
        if (existing == null) {
            existing = new DeviceToken(userId, req.getToken(),
                    req.getPlatform() == null ? "ANDROID" : req.getPlatform());
        } else {
            existing.setUserId(userId);
            existing.setPlatform(req.getPlatform() == null ? existing.getPlatform() : req.getPlatform());
            existing.setLastSeenAt(Instant.now());
        }
        tokenRepository.save(existing);
        log.info("Registered device token for user {} (platform={})", userId, existing.getPlatform());
        return ResponseEntity.ok(ApiResponse.success(null, "Device registered"));
    }

    /** Called on logout. Path-encoded so FCM tokens (which can contain
     *  dashes/underscores but not slashes) round-trip safely. */
    @DeleteMapping("/me/{token}")
    public ResponseEntity<ApiResponse<Void>> unregister(
            @AuthenticationPrincipal String userId,
            @PathVariable String token) {
        if (userId == null || token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing token"));
        }
        // Defensive: only allow a user to delete their own token.
        DeviceToken existing = tokenRepository.findByToken(token).orElse(null);
        if (existing == null) {
            return ResponseEntity.ok(ApiResponse.success(null, "Already unregistered"));
        }
        if (!userId.equals(existing.getUserId())) {
            // Don't reveal that the token belongs to someone else.
            return ResponseEntity.ok(ApiResponse.success(null, "Already unregistered"));
        }
        tokenRepository.deleteByToken(token);
        log.info("Unregistered device token for user {}", userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Device unregistered"));
    }
}
