package com.saas.school.common.audit;

import com.saas.school.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Super Admin - Audit Logs")
@RestController
@RequestMapping("/api/v1/super/audit-logs")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AuditLogController {

    private static final Logger log = LoggerFactory.getLogger(AuditLogController.class);

    @Autowired private MongoTemplate mongoTemplate;

    @Operation(summary = "Query audit logs with filters (paginated)")
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String search) {

        Query query = new Query();

        if (action != null && !action.isEmpty()) {
            query.addCriteria(Criteria.where("action").is(action));
        }
        if (entityType != null && !entityType.isEmpty()) {
            query.addCriteria(Criteria.where("entityType").is(entityType));
        }
        if (tenantId != null && !tenantId.isEmpty()) {
            query.addCriteria(Criteria.where("tenantId").is(tenantId));
        }
        if (userId != null && !userId.isEmpty()) {
            query.addCriteria(Criteria.where("userId").is(userId));
        }
        if (from != null && !from.isEmpty()) {
            query.addCriteria(Criteria.where("timestamp").gte(Instant.parse(from)));
        }
        if (to != null && !to.isEmpty()) {
            query.addCriteria(Criteria.where("timestamp").lte(Instant.parse(to)));
        }
        if (search != null && !search.isEmpty()) {
            query.addCriteria(Criteria.where("description").regex(search, "i"));
        }

        long totalElements = mongoTemplate.count(query, "audit_logs");

        query.with(Sort.by(Sort.Direction.DESC, "timestamp"));
        query.skip((long) page * size);
        query.limit(size);

        List<AuditLog> content = mongoTemplate.find(query, AuditLog.class, "audit_logs");

        Map<String, Object> result = new HashMap<>();
        result.put("content", content);
        result.put("totalElements", totalElements);
        result.put("page", page);
        result.put("size", size);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @Operation(summary = "Get distinct action types for filter dropdown")
    @GetMapping("/actions")
    public ResponseEntity<ApiResponse<List<String>>> getDistinctActions() {
        List<String> actions = mongoTemplate.findDistinct(
                new Query(), "action", "audit_logs", String.class);
        return ResponseEntity.ok(ApiResponse.success(actions));
    }

    @Operation(summary = "Get distinct entity types for filter dropdown")
    @GetMapping("/entity-types")
    public ResponseEntity<ApiResponse<List<String>>> getDistinctEntityTypes() {
        List<String> entityTypes = mongoTemplate.findDistinct(
                new Query(), "entityType", "audit_logs", String.class);
        return ResponseEntity.ok(ApiResponse.success(entityTypes));
    }
}
