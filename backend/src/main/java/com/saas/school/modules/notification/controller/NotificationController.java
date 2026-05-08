package com.saas.school.modules.notification.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.notification.dto.PublishResultPreviewResponse;
import com.saas.school.modules.notification.dto.PublishResultRequest;
import com.saas.school.modules.notification.dto.PublishResultResponse;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationService;
import com.saas.school.modules.notification.service.ResultPublicationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
    @Autowired private ResultPublicationService resultPublicationService;

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

    /**
     * Preview a result publication: counts of recipients, a sample
     * personalised message, and a banner if the same scope was already
     * published before. Pure read; doesn't write anything.
     *
     * Uses POST so the body shape stays identical to /publish-result and
     * the front-end can submit the same form for both calls.
     */
    @PostMapping("/publish-result/preview")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PublishResultPreviewResponse>> previewPublishResult(
            @Valid @RequestBody PublishResultRequest req) {
        return ResponseEntity.ok(ApiResponse.success(resultPublicationService.preview(req)));
    }

    /**
     * Fan out personalised result notifications to every student in the
     * scope plus their parents. Refuses to overwrite a prior publication
     * unless {@code republish=true}. SCHOOL_ADMIN / PRINCIPAL only —
     * teachers can enter marks but not publish results school-wide.
     */
    @PostMapping("/publish-result")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
    public ResponseEntity<ApiResponse<PublishResultResponse>> publishResult(
            @Valid @RequestBody PublishResultRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                resultPublicationService.publish(req, userId), "Result published"));
    }
}
