package com.saas.school.modules.notification.dto;

import java.time.Instant;

/**
 * Response shape for {@code POST /api/v1/notifications/publish-result}.
 * {@code republished} is true iff this overwrote a previous publication;
 * the snackbar in the UI uses it to phrase the success message.
 */
public record PublishResultResponse(
        int examsCovered,
        int studentsNotified,
        int parentsNotified,
        int skippedStudents,
        boolean republished,
        Instant publishedAt
) {}
