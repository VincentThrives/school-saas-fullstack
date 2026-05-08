package com.saas.school.modules.notification.dto;

import java.time.Instant;

/**
 * Response shape for {@code POST /api/v1/notifications/publish-result/preview}.
 * Lets the admin sanity-check counts and a sample message body before
 * actually firing the fan-out. {@code alreadyPublishedAt} is the
 * timestamp of the most recent publish for the same scope, or null
 * when this would be the first publish.
 */
public record PublishResultPreviewResponse(
        int examsCovered,
        int studentCount,
        int parentCount,
        int totalRecipients,
        String sampleStudentName,
        String sampleTitle,
        String sampleBody,
        Instant alreadyPublishedAt,
        int previousPublishCount
) {}
