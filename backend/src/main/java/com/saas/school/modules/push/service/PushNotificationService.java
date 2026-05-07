package com.saas.school.modules.push.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import com.google.firebase.messaging.BatchResponse;
import com.saas.school.modules.push.model.DeviceToken;
import com.saas.school.modules.push.repository.DeviceTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends Firebase Cloud Messaging push notifications.
 *
 * Public methods are async — fire-and-forget from the caller's perspective —
 * so creating a notification record (the moment most pushes get triggered)
 * doesn't block on Google's API.
 *
 * Failure handling: when FCM reports a token as INVALID_ARGUMENT or
 * UNREGISTERED, we delete that token from our DB so we don't keep
 * retrying it. All other errors are logged but don't bubble up — push
 * is best-effort and we never want it to break the parent operation.
 *
 * If FcmConfig couldn't initialize (credentials missing on Render), every
 * call is a quiet no-op. The {@link #isEnabled()} check at the top of each
 * method prevents NPEs from {@code FirebaseMessaging.getInstance()}.
 */
@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    @Autowired
    private DeviceTokenRepository tokenRepository;

    /** True when FirebaseApp initialized successfully at boot. */
    private boolean isEnabled() {
        return FirebaseApp.getApps() != null && !FirebaseApp.getApps().isEmpty();
    }

    /**
     * Send a push to one user (across all of their registered devices).
     * Most callers will use this — they have the userId, not the tokens.
     */
    @Async
    public void sendToUser(String userId, String title, String body, Map<String, String> data) {
        if (!isEnabled() || userId == null) return;
        List<DeviceToken> tokens = tokenRepository.findByUserId(userId);
        if (tokens.isEmpty()) {
            log.debug("No device tokens registered for user {}, skipping push", userId);
            return;
        }
        List<String> tokenStrings = new ArrayList<>(tokens.size());
        for (DeviceToken t : tokens) tokenStrings.add(t.getToken());
        sendToTokens(tokenStrings, title, body, data);
    }

    /** Send to many users at once (e.g. an admin announcement to all parents). */
    @Async
    public void sendToUsers(List<String> userIds, String title, String body, Map<String, String> data) {
        if (!isEnabled() || userIds == null || userIds.isEmpty()) return;
        List<String> allTokens = new ArrayList<>();
        for (String uid : userIds) {
            tokenRepository.findByUserId(uid)
                    .forEach(t -> allTokens.add(t.getToken()));
        }
        if (allTokens.isEmpty()) return;
        sendToTokens(allTokens, title, body, data);
    }

    /**
     * Low-level: send to a list of FCM tokens directly. Splits into FCM's
     * multicast batch limit (500 tokens per batch) and cleans up dead
     * tokens from our DB based on the per-token responses.
     */
    public void sendToTokens(List<String> tokens, String title, String body, Map<String, String> data) {
        if (!isEnabled() || tokens == null || tokens.isEmpty()) return;

        Notification notification = Notification.builder()
                .setTitle(title == null ? "" : title)
                .setBody(body == null ? "" : body)
                .build();

        Map<String, String> safeData = data == null ? Collections.emptyMap() : new HashMap<>(data);

        // FCM caps multicast at 500 tokens per request.
        for (int i = 0; i < tokens.size(); i += 500) {
            List<String> batch = tokens.subList(i, Math.min(i + 500, tokens.size()));
            MulticastMessage message = MulticastMessage.builder()
                    .setNotification(notification)
                    .putAllData(safeData)
                    .addAllTokens(batch)
                    .build();

            try {
                BatchResponse response = FirebaseMessaging.getInstance().sendEachForMulticast(message);
                handleBatchResponse(batch, response);
            } catch (FirebaseMessagingException e) {
                log.error("FCM batch send failed: {}", e.getMessage(), e);
            } catch (Exception e) {
                log.error("Unexpected error sending FCM batch: {}", e.getMessage(), e);
            }
        }
    }

    /**
     * After a batch send, FCM returns one SendResponse per token. We use
     * those to drop dead tokens from our DB so subsequent pushes don't
     * waste requests on them.
     */
    private void handleBatchResponse(List<String> batchTokens, BatchResponse response) {
        if (response.getFailureCount() == 0) return;

        List<SendResponse> results = response.getResponses();
        for (int j = 0; j < results.size(); j++) {
            SendResponse r = results.get(j);
            if (r.isSuccessful()) continue;

            String failedToken = batchTokens.get(j);
            FirebaseMessagingException ex = r.getException();
            String errCode = ex != null && ex.getMessagingErrorCode() != null
                    ? ex.getMessagingErrorCode().name() : "UNKNOWN";

            // Tokens that are permanently dead — phone uninstalled the app,
            // user revoked notifications, or Google rotated the token. Remove
            // from our DB so future pushes don't include them.
            if ("UNREGISTERED".equals(errCode) || "INVALID_ARGUMENT".equals(errCode)) {
                try {
                    tokenRepository.deleteByToken(failedToken);
                    log.info("Removed dead FCM token (errCode={})", errCode);
                } catch (Exception e) {
                    log.warn("Failed to clean up dead token: {}", e.getMessage());
                }
            } else {
                // Transient errors (UNAVAILABLE, INTERNAL, QUOTA_EXCEEDED) —
                // leave the token, FCM will retry on its own next time.
                log.warn("FCM send failed for one token (errCode={}): {}",
                        errCode, ex == null ? "no detail" : ex.getMessage());
            }
        }
    }
}
