package com.saas.school.modules.fee.service;

import com.saas.school.modules.fee.model.FeeCounter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Atomically produces the next receipt number for a given academic year.
 * Uses findAndModify with upsert so two concurrent payments can never
 * receive the same number.
 */
@Service
public class FeeReceiptCounterService {

    @Autowired
    private MongoTemplate mongoTemplate;

    /**
     * Returns the next receipt number for the given academicYearId, formatted
     * as "REC-{year}-{0000sequence}", e.g. "REC-2026-0001".
     */
    public String nextReceiptNumber(String academicYearLabel, String academicYearId) {
        String counterId = "RECEIPT::" + (academicYearId == null ? "global" : academicYearId);
        Query q = new Query(Criteria.where("_id").is(counterId));
        Update u = new Update().inc("lastReceipt", 1L);
        FindAndModifyOptions opts = FindAndModifyOptions.options().returnNew(true).upsert(true);
        FeeCounter updated = mongoTemplate.findAndModify(q, u, opts, FeeCounter.class);
        long seq = updated != null ? updated.getLastReceipt() : 1L;
        String yearPrefix = extractYearPrefix(academicYearLabel);
        return String.format("REC-%s-%04d", yearPrefix, seq);
    }

    /** Best-effort year prefix ("2026-27" -> "2026"); falls back to "STD". */
    private String extractYearPrefix(String label) {
        if (label == null || label.isBlank()) return "STD";
        String trimmed = label.trim();
        int dash = trimmed.indexOf('-');
        if (dash > 0) return trimmed.substring(0, dash).replaceAll("[^0-9]", "");
        return trimmed.replaceAll("[^0-9]", "");
    }
}
