package com.saas.school.modules.exam.dto;

import java.util.List;

/**
 * Outcome of a bulk-create-exam call. Reports how many docs were actually
 * created vs. skipped (duplicates / no matching subject configuration),
 * plus the per-skip reasons so the UI can show a friendly summary.
 */
public class BulkCreateExamResponse {
    private int created;
    private int skippedDuplicate;
    private int skippedNotConfigured;
    private List<String> createdExamIds;

    public BulkCreateExamResponse() {}

    public BulkCreateExamResponse(int created, int skippedDuplicate, int skippedNotConfigured,
                                  List<String> createdExamIds) {
        this.created = created;
        this.skippedDuplicate = skippedDuplicate;
        this.skippedNotConfigured = skippedNotConfigured;
        this.createdExamIds = createdExamIds;
    }

    public int getCreated() { return created; }
    public void setCreated(int created) { this.created = created; }

    public int getSkippedDuplicate() { return skippedDuplicate; }
    public void setSkippedDuplicate(int skippedDuplicate) { this.skippedDuplicate = skippedDuplicate; }

    public int getSkippedNotConfigured() { return skippedNotConfigured; }
    public void setSkippedNotConfigured(int skippedNotConfigured) { this.skippedNotConfigured = skippedNotConfigured; }

    public List<String> getCreatedExamIds() { return createdExamIds; }
    public void setCreatedExamIds(List<String> createdExamIds) { this.createdExamIds = createdExamIds; }
}
