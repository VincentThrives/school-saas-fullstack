package com.saas.school.modules.sms.service;

import java.util.Map;

/**
 * Abstraction over the SMS gateway. Today there's one implementation
 * ({@link Msg91SmsProvider}); the interface exists so we can swap
 * Gupshup, Kaleyra, or a self-hosted aggregator later without
 * touching {@link SmsService}.
 *
 * Implementations MUST be:
 *   - Idempotent on retries (use providerRequestId if available)
 *   - Tolerant of partial failures (one bad number in a batch shouldn't
 *     fail the whole call)
 *   - Synchronous from the caller's perspective — SmsService handles
 *     async dispatch via @Async on its public methods
 */
public interface SmsProvider {

    /** Send one templated SMS. Caller has already validated the phone. */
    SendResult send(SendArgs args);

    /**
     * @param recipientPhone E.164 phone (+91XXXXXXXXXX), already normalised
     * @param templateId     DLT-approved template id (e.g. 1707...)
     * @param senderId       6-char header (e.g. VTPLS)
     * @param variables      Template variables: var1 → "Ravi Kumar", etc.
     *                       MSG91 uses named keys ("VAR1", "VAR2", ...),
     *                       implementation translates as needed.
     */
    record SendArgs(
            String recipientPhone,
            String templateId,
            String senderId,
            Map<String, String> variables) {
    }

    /**
     * Result of a send attempt. {@code success=false} doesn't necessarily
     * mean delivery failure — could be a network glitch worth retrying.
     * SmsService inspects {@code errorCode} to decide retry vs give up.
     */
    record SendResult(
            boolean success,
            String messageId,    // present when accepted, null on failure
            String errorCode,    // provider-specific, null on success
            String errorMessage  // human-readable, null on success
    ) {
        public static SendResult ok(String messageId) {
            return new SendResult(true, messageId, null, null);
        }
        public static SendResult fail(String code, String message) {
            return new SendResult(false, null, code, message);
        }
    }
}
