package com.saas.school.modules.notification.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name="Notifications")
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    @Autowired private NotificationService notificationService;

    /**
     * Default: notifications visible to the current user (inbox).
     * With ?sentByMe=true: notifications the user has sent (history).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<Notification>>> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean sentByMe) {
        Page<Notification> result = sentByMe
                ? notificationService.listSentBy(userId, page, size)
                : notificationService.listForUser(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(
                PageResponse.of(result.getContent(), result.getTotalElements(), page, size)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
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
