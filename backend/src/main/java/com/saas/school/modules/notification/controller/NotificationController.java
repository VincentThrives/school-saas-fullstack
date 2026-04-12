package com.saas.school.modules.notification.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@Tag(name="Notifications")
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','TEACHER')")
    public ResponseEntity<ApiResponse<Notification>> send(
            @RequestBody Notification req, @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(notificationService.send(req, userId), "Sent"));
    }
    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(
            @PathVariable String id, @AuthenticationPrincipal String userId) {
        notificationService.markRead(id, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Marked as read"));
    }
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> unreadCount(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(notificationService.countUnread(userId)));
    }
}