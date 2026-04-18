package com.saas.school.modules.notification.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.notification.model.NotificationTemplate;
import com.saas.school.modules.notification.repository.NotificationTemplateRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Notification Templates")
@RestController
@RequestMapping("/api/v1/notification-templates")
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
public class NotificationTemplateController {

    @Autowired private NotificationTemplateRepository repo;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationTemplate>>> list() {
        return ResponseEntity.ok(ApiResponse.success(repo.findAllByOrderByUpdatedAtDesc()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<NotificationTemplate>> create(
            @RequestBody NotificationTemplate req,
            @AuthenticationPrincipal String userId) {
        req.setTemplateId(UUID.randomUUID().toString());
        req.setCreatedBy(userId);
        return ResponseEntity.ok(ApiResponse.success(repo.save(req), "Template created"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<NotificationTemplate>> update(
            @PathVariable String id,
            @RequestBody NotificationTemplate req) {
        NotificationTemplate existing = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        existing.setName(req.getName() != null ? req.getName() : existing.getName());
        existing.setTitle(req.getTitle() != null ? req.getTitle() : existing.getTitle());
        existing.setBody(req.getBody() != null ? req.getBody() : existing.getBody());
        existing.setType(req.getType() != null ? req.getType() : existing.getType());
        existing.setDefaultChannel(req.getDefaultChannel() != null ? req.getDefaultChannel() : existing.getDefaultChannel());
        return ResponseEntity.ok(ApiResponse.success(repo.save(existing), "Template updated"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        repo.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Template deleted"));
    }
}
