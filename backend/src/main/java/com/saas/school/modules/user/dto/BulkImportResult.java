package com.saas.school.modules.user.dto;

import java.util.List;

public class BulkImportResult {

    private int successCount;
    private int errorCount;
    private List<String> errors;

    public BulkImportResult() {
    }

    public BulkImportResult(int successCount, int errorCount, List<String> errors) {
        this.successCount = successCount;
        this.errorCount = errorCount;
        this.errors = errors;
    }

    public int getSuccessCount() {
        return successCount;
    }

    public void setSuccessCount(int successCount) {
        this.successCount = successCount;
    }

    public int getErrorCount() {
        return errorCount;
    }

    public void setErrorCount(int errorCount) {
        this.errorCount = errorCount;
    }

    public List<String> getErrors() {
        return errors;
    }

    public void setErrors(List<String> errors) {
        this.errors = errors;
    }
}
