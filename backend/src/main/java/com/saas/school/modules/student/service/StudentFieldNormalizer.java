package com.saas.school.modules.student.service;

/**
 * Centralised text normalisation for Student fields. Applied on every
 * write (bulk import + single create + update) so the database stays
 * consistent regardless of how data lands.
 *
 * <ul>
 *   <li><b>Title Case</b> for names + address parts ("vincent kumar" → "Vincent Kumar").</li>
 *   <li><b>UPPERCASE</b> for sections, gender, blood group.</li>
 *   <li><b>lowercase</b> for emails.</li>
 *   <li><b>Digits only</b> for phone fields (strips spaces, hyphens, "+91" prefixes).</li>
 * </ul>
 *
 * <p>All methods are null-safe — null in → null out, blank in → null out
 * (so empty Excel cells don't pollute the doc with empty strings).
 */
public final class StudentFieldNormalizer {
    private StudentFieldNormalizer() {}

    /** "vincent kumar"/"VINCENT KUMAR" → "Vincent Kumar". O'Connor stays O'Connor. */
    public static String titleCase(String in) {
        String s = trimToNull(in);
        if (s == null) return null;
        StringBuilder out = new StringBuilder(s.length());
        boolean capitalizeNext = true;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isWhitespace(c)) {
                out.append(c);
                capitalizeNext = true;
            } else if (c == '-' || c == '\'' || c == '.') {
                // Word-internal punctuation: preserve, capitalise next char too
                // ("o'connor" → "O'Connor", "jean-luc" → "Jean-Luc").
                out.append(c);
                capitalizeNext = true;
            } else {
                out.append(capitalizeNext ? Character.toUpperCase(c) : Character.toLowerCase(c));
                capitalizeNext = false;
            }
        }
        return out.toString();
    }

    /** "  a " → "A". Used for section names. */
    public static String upper(String in) {
        String s = trimToNull(in);
        return s == null ? null : s.toUpperCase();
    }

    /** "  VINCENT@FOO.com " → "vincent@foo.com". */
    public static String lower(String in) {
        String s = trimToNull(in);
        return s == null ? null : s.toLowerCase();
    }

    /** "(+91) 98765-43210" → "9876543210" (last 10 digits kept). */
    public static String phoneDigits(String in) {
        String s = trimToNull(in);
        if (s == null) return null;
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') out.append(c);
        }
        String digits = out.toString();
        // If the admin pasted with country code, keep the last 10 (Indian
        // numbers); for anything else, return as-is and let the validator decide.
        if (digits.length() > 10 && digits.startsWith("91")) {
            return digits.substring(digits.length() - 10);
        }
        return digits.isEmpty() ? null : digits;
    }

    /** Collapse internal whitespace + trim; return null when result is empty. */
    public static String trimToNull(String in) {
        if (in == null) return null;
        String s = in.replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? null : s;
    }

    /**
     * Slugify a name for use as a student login username:
     * lowercase, alphanumeric only — drop spaces, hyphens, accents.
     *
     * <p>Used to convert {@code Student.firstName} into a stable login id.
     * "Varun" → "varun", "  Varun K. " → "varunk", "Aarón" → "aaron".
     * The auth path lowercases the typed username so login stays
     * case-insensitive even if the admin later changes the stored value.</p>
     *
     * <p>Returns null when the input has no usable letters (e.g. only
     * symbols or empty) — caller falls back to a default placeholder.</p>
     */
    public static String usernameSlug(String in) {
        String s = trimToNull(in);
        if (s == null) return null;
        // Strip accents: NFKD then drop combining marks.
        String stripped = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFKD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        StringBuilder out = new StringBuilder(stripped.length());
        for (int i = 0; i < stripped.length(); i++) {
            char c = stripped.charAt(i);
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                out.append(c);
            } else if (c >= 'A' && c <= 'Z') {
                out.append((char) (c + ('a' - 'A')));
            }
            // everything else (spaces, hyphens, dots, punctuation) is dropped
        }
        return out.length() == 0 ? null : out.toString();
    }

    /**
     * Format a date of birth as the student's default password: {@code DDMMYYYY}.
     * "2001-04-02" → "02042001". Null in → null out (caller validates DOB is
     * required upstream).
     */
    public static String dobAsPassword(java.time.LocalDate dob) {
        if (dob == null) return null;
        return String.format("%02d%02d%04d", dob.getDayOfMonth(), dob.getMonthValue(), dob.getYear());
    }
}
