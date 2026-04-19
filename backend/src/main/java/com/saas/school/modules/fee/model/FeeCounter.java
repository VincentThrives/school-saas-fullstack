package com.saas.school.modules.fee.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Small counter document used to produce monotonic per-academic-year receipt
 * numbers for fee payments. One document per counterId (e.g. one per AY).
 * Mutated via $inc / findAndModify for atomicity.
 */
@Document(collection = "fee_counters")
public class FeeCounter {

    @Id
    private String counterId;   // e.g. "RECEIPT::2026-27"

    private long lastReceipt;

    public FeeCounter() {}

    public FeeCounter(String counterId, long lastReceipt) {
        this.counterId = counterId;
        this.lastReceipt = lastReceipt;
    }

    public String getCounterId() { return counterId; }
    public void setCounterId(String counterId) { this.counterId = counterId; }

    public long getLastReceipt() { return lastReceipt; }
    public void setLastReceipt(long lastReceipt) { this.lastReceipt = lastReceipt; }
}
