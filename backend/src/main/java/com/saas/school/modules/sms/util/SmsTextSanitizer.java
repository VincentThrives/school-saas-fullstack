package com.saas.school.modules.sms.util;

/**
 * Normalizes user-typed strings to a GSM-7-safe form before they enter
 * the SMS variable map. Without this, characters pasted from Word /
 * Notes / web pages (em-dash, smart quotes, non-breaking space, etc.)
 * survive the round trip to MSG91, which then transcodes the unknown
 * bytes into a literal "?" inside the delivered SMS body.
 *
 * <p>The substitution table maps each common Unicode variant (by
 * codepoint) to its closest 7-bit ASCII equivalent. Anything that
 * remains outside printable ASCII after the substitutions is dropped
 * silently. Codepoint integers keep this source file pure ASCII so
 * the file is byte-identical regardless of editor or git settings.</p>
 */
public final class SmsTextSanitizer {

    private SmsTextSanitizer() {}

    private static final int[][] SUBSTITUTIONS = {
            { 0x2018, '\'' },   // left single quotation mark
            { 0x2019, '\'' },   // right single quotation mark
            { 0x201C, '"'  },   // left double quotation mark
            { 0x201D, '"'  },   // right double quotation mark
            { 0x2013, '-'  },   // en dash
            { 0x2014, '-'  },   // em dash
            { 0x2212, '-'  },   // minus sign
            { 0x00A0, ' '  },   // non-breaking space
            { 0x2009, ' '  },   // thin space
            { 0x202F, ' '  },   // narrow no-break space
            { 0x2022, '-'  },   // bullet
            { 0x2027, '-'  },   // hyphenation point
            { 0x00B7, '-'  },   // middle dot
    };

    private static final int ELLIPSIS = 0x2026;

    public static String gsm7Safe(String s) {
        if (s == null) return null;

        StringBuilder out = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);

            if (c == ELLIPSIS) {
                out.append("...");
                continue;
            }

            int substitute = -1;
            for (int[] row : SUBSTITUTIONS) {
                if (row[0] == c) { substitute = row[1]; break; }
            }
            if (substitute != -1) {
                out.append((char) substitute);
                continue;
            }

            if (c == '\n' || (c >= 0x20 && c <= 0x7E)) {
                out.append(c);
            }
        }
        return out.toString().trim();
    }
}
