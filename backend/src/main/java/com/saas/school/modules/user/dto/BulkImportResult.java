package com.saas.school.modules.user.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;
@Data @AllArgsConstructor
public class BulkImportResult {
    private int successCount;
    private int errorCount;
    private List<String> errors;
}
