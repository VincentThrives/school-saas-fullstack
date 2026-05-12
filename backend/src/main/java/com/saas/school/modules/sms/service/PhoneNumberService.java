package com.saas.school.modules.sms.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Normalises and validates Indian mobile numbers for SMS dispatch.
 *
 * The platform stores phone numbers in various formats (entered by
 * different admins over time) — sometimes "9876543210", sometimes
 * "+91 98765-43210", sometimes "0987654321321" with garbage prefix.
 * MSG91 expects strict E.164 ({@code +91XXXXXXXXXX}). This service
 * normalises all of them to that single canonical shape and validates.
 *
 * Indian mobile rules (TRAI):
 *   - 10 digits
 *   - first digit must be 6, 7, 8, or 9
 *   - country code +91 is implicit
 */
@Service
public class PhoneNumberService {

    /**
     * Normalise to E.164 {@code +91XXXXXXXXXX} or return empty if the
     * input can't be coerced to a valid Indian mobile.
     *
     * Accepts:
     *   "9876543210"           → "+919876543210"
     *   "+919876543210"        → "+919876543210"
     *   "91 9876 543 210"      → "+919876543210"
     *   "+91-98765-43210"      → "+919876543210"
     *   "09876543210"          → "+919876543210"  (drops trunk-prefix 0)
     *
     * Rejects:
     *   "1234567890"           → empty (starts with 1, not a mobile)
     *   "98765"                → empty (too short)
     *   ""                     → empty
     *   "abc"                  → empty
     */
    public Optional<String> normalize(String raw) {
        if (raw == null) return Optional.empty();

        // Strip every non-digit character. "+91-98765 43210" → "919876543210"
        String digits = raw.replaceAll("\\D+", "");
        if (digits.isEmpty()) return Optional.empty();

        // Drop leading "0" (trunk prefix) once.
        if (digits.startsWith("0") && digits.length() > 10) {
            digits = digits.substring(1);
        }

        // Drop leading "91" (country code) once — common when admin pastes
        // "919876543210". After this we should have exactly 10 digits.
        if (digits.startsWith("91") && digits.length() == 12) {
            digits = digits.substring(2);
        }

        if (digits.length() != 10) return Optional.empty();

        // First digit must be 6/7/8/9 — TRAI rule for Indian mobiles.
        char first = digits.charAt(0);
        if (first < '6' || first > '9') return Optional.empty();

        return Optional.of("+91" + digits);
    }

    /** Quick boolean — most call-sites just want yes/no. */
    public boolean isValidIndianMobile(String raw) {
        return normalize(raw).isPresent();
    }

    /**
     * Normalise a list of raw phone numbers, drop invalids, dedupe.
     * Order preserved (LinkedHashSet). Empty list if nothing valid.
     *
     * Used by SmsService when fanning out one notification to many
     * recipients — invalid phones get logged + skipped, not sent.
     */
    public List<String> normalizeAndDedupe(List<String> raws) {
        if (raws == null || raws.isEmpty()) return List.of();
        Set<String> out = new LinkedHashSet<>();
        for (String raw : raws) {
            normalize(raw).ifPresent(out::add);
        }
        return List.copyOf(out);
    }
}
