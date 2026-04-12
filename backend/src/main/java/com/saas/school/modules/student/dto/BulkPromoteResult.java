package com.saas.school.modules.student.dto;
import lombok.AllArgsConstructor; import lombok.Data;
@Data @AllArgsConstructor
public class BulkPromoteResult { private int promoted, skipped; }