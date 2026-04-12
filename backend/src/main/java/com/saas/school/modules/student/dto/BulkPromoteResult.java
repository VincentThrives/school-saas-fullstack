package com.saas.school.modules.student.dto;

public class BulkPromoteResult {

    private int promoted;
    private int skipped;

    public BulkPromoteResult() {
    }

    public BulkPromoteResult(int promoted, int skipped) {
        this.promoted = promoted;
        this.skipped = skipped;
    }

    public int getPromoted() {
        return promoted;
    }

    public void setPromoted(int promoted) {
        this.promoted = promoted;
    }

    public int getSkipped() {
        return skipped;
    }

    public void setSkipped(int skipped) {
        this.skipped = skipped;
    }
}
