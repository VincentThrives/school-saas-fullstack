package com.saas.school.modules.biometricterminal.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-day, per-tenant idempotency log for the auto-absent job. Lives
 * in each tenant's own DB (so isolation is automatic — no tenantId
 * field needed). Presence of a row with {@code _id = dateKey} means
 * the job already processed that date for this tenant and should
 * skip it on subsequent ticks.
 */
@Document(collection = "auto_absent_log")
public class AutoAbsentLog {

    /** ISO date "yyyy-MM-dd" — the day this run processed. Used as the
     *  unique key so a second insert with the same date collides. */
    @Id
    private String dateKey;

    /** How many students were flipped from missing-scan → ABSENT on
     *  this tenant on this date. Useful for the "how big was the
     *  auto-absent action today?" audit query. */
    private int markedAbsent;

    /** Wall-clock time the job actually ran. */
    private Instant ranAt;

    public AutoAbsentLog() {}

    public AutoAbsentLog(String dateKey, int markedAbsent, Instant ranAt) {
        this.dateKey = dateKey;
        this.markedAbsent = markedAbsent;
        this.ranAt = ranAt;
    }

    public String getDateKey() { return dateKey; }
    public void setDateKey(String dateKey) { this.dateKey = dateKey; }

    public int getMarkedAbsent() { return markedAbsent; }
    public void setMarkedAbsent(int markedAbsent) { this.markedAbsent = markedAbsent; }

    public Instant getRanAt() { return ranAt; }
    public void setRanAt(Instant ranAt) { this.ranAt = ranAt; }
}
