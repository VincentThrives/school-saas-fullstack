package com.saas.school.modules.push.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Initializes the Firebase Admin SDK once at boot so push notifications
 * can be sent from anywhere in the app via {@code FirebaseMessaging.getInstance()}.
 *
 * Credential resolution order:
 *   1. {@code FIREBASE_CREDENTIALS_PATH} env var → path to the service-account
 *      JSON file. On Render this is set to whatever path you mounted the
 *      Secret File at (e.g. {@code /etc/secrets/firebase-adminsdk.json}).
 *   2. {@code FIREBASE_CREDENTIALS_JSON} env var → the entire JSON content
 *      pasted as the env value. Fallback for hosting platforms without
 *      Secret Files. Less safe (env vars may show in logs) but works.
 *   3. Neither set → push notifications disabled with a clear log warning.
 *      Backend continues to start and run normally; only push send calls
 *      become no-ops.
 *
 * The class is designed to FAIL SOFTLY: if FCM init throws, we log the
 * error and let the rest of the app boot. Push is a feature, not a hard
 * requirement.
 */
@Configuration
public class FcmConfig {

    private static final Logger log = LoggerFactory.getLogger(FcmConfig.class);

    @Value("${firebase.credentials-path:}")
    private String credentialsPath;

    @Value("${firebase.credentials-json:}")
    private String credentialsJson;

    @PostConstruct
    public void init() {
        try {
            if (FirebaseApp.getApps() != null && !FirebaseApp.getApps().isEmpty()) {
                log.info("FirebaseApp already initialized, skipping");
                return;
            }

            GoogleCredentials credentials = resolveCredentials();
            if (credentials == null) {
                log.warn("Firebase credentials not configured (FIREBASE_CREDENTIALS_PATH " +
                         "or FIREBASE_CREDENTIALS_JSON missing) — push notifications " +
                         "will be disabled. Set the env var on Render to enable.");
                return;
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();
            FirebaseApp.initializeApp(options);
            log.info("FirebaseApp initialized successfully — push notifications active");
        } catch (Exception e) {
            log.error("Failed to initialize FirebaseApp — push notifications disabled. " +
                      "Cause: {}", e.getMessage(), e);
            // Don't rethrow — let the app boot.
        }
    }

    private GoogleCredentials resolveCredentials() throws IOException {
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            Path p = Path.of(credentialsPath);
            if (Files.exists(p)) {
                try (FileInputStream in = new FileInputStream(p.toFile())) {
                    return GoogleCredentials.fromStream(in);
                }
            }
            log.warn("FIREBASE_CREDENTIALS_PATH points to non-existent file: {}", credentialsPath);
        }
        if (credentialsJson != null && !credentialsJson.isBlank()) {
            return GoogleCredentials.fromStream(
                    new java.io.ByteArrayInputStream(credentialsJson.getBytes()));
        }
        return null;
    }
}
