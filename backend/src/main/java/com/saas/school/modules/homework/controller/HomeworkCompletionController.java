package com.saas.school.modules.homework.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.homework.dto.BatchSaveRequest;
import com.saas.school.modules.homework.dto.MarkHomeworkRequest;
import com.saas.school.modules.homework.service.HomeworkCompletionService;
import com.saas.school.modules.homework.service.HomeworkCompletionService.BatchEntry;
import com.saas.school.modules.homework.service.HomeworkCompletionService.RosterView;
import com.saas.school.modules.homework.service.HomeworkCompletionService.UndoneStudent;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Homework")
@RestController
@RequestMapping("/api/v1/homework")
public class HomeworkCompletionController {

    @Autowired private HomeworkCompletionService service;

    /** Teacher's roster popup — expected students + done/pending status. */
    @GetMapping("/{homeworkId}/roster")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','PRINCIPAL','SCHOOL_COORDINATOR')")
    public ResponseEntity<ApiResponse<RosterView>> roster(@PathVariable String homeworkId) {
        return ResponseEntity.ok(ApiResponse.success(service.roster(homeworkId)));
    }

    /** Toggle one student's completion for the given homework. */
    @PostMapping("/{homeworkId}/completion")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','PRINCIPAL','SCHOOL_COORDINATOR')")
    public ResponseEntity<ApiResponse<Void>> mark(
            @PathVariable String homeworkId,
            @Valid @RequestBody MarkHomeworkRequest req,
            @AuthenticationPrincipal String userId) {
        service.mark(homeworkId, req.getStudentId(), req.getStatus(), userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Saved"));
    }

    /**
     * Batch save the whole roster from the teacher Roster page in one
     * request. When {@code notifyUndone} is true, also fires a reminder
     * notification to every student still marked undone AFTER the save.
     * Returns a small summary map for the snackbar on the frontend.
     */
    @PutMapping("/{homeworkId}/completions")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','PRINCIPAL','SCHOOL_COORDINATOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> batchSave(
            @PathVariable String homeworkId,
            @Valid @RequestBody BatchSaveRequest req,
            @AuthenticationPrincipal String userId) {

        List<BatchEntry> entries = req.getEntries().stream()
                .map(e -> new BatchEntry(e.getStudentId(), e.getStatus(), e.getRemark()))
                .toList();
        service.batchSave(homeworkId, entries, userId);

        int notified = 0;
        if (req.isNotifyUndone()) {
            notified = service.notifyUndone(homeworkId, userId);
        }

        Map<String, Object> out = new HashMap<>();
        out.put("saved", entries.size());
        out.put("notified", notified);
        return ResponseEntity.ok(ApiResponse.success(out, "Saved"));
    }

    /** Student's own status for a specific homework — used by the detail
     *  popup on the student Homework page. */
    @GetMapping("/{homeworkId}/my-completion")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> myCompletion(
            @PathVariable String homeworkId,
            @AuthenticationPrincipal String userId) {
        boolean done = service.isDoneForUser(homeworkId, userId);
        Map<String, Object> out = new HashMap<>();
        out.put("homeworkId", homeworkId);
        out.put("done", done);
        return ResponseEntity.ok(ApiResponse.success(out));
    }

    /** Batched status lookup — legacy boolean form (feeds the
     *  dashboard tile's "N pending, M done" count). */
    @PostMapping("/status-batch")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> statusBatch(
            @RequestBody java.util.List<String> homeworkIds,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.doneStatusForUser(homeworkIds, userId)));
    }

    /**
     * Teacher accordion feed — per homework, the roll of students who
     * are still not DONE (HALF or never-marked). Powers the inline
     * "Not done ({{n}})" panel on the teacher Homework list card so
     * teachers don't need to open the roster page for a glance at who
     * still owes work.
     */
    @PostMapping("/undone-batch")
    @PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','PRINCIPAL','SCHOOL_COORDINATOR')")
    public ResponseEntity<ApiResponse<Map<String, List<UndoneStudent>>>> undoneBatch(
            @RequestBody List<String> homeworkIds) {
        return ResponseEntity.ok(ApiResponse.success(service.undoneForHomeworks(homeworkIds)));
    }

    /** Richer batched status lookup — returns the DONE/HALF/PENDING
     *  enum name (or null when never marked). Powers the student
     *  Homework list chip that distinguishes "not marked" from
     *  "explicitly marked not done + nudged". */
    @PostMapping("/status-batch-full")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    public ResponseEntity<ApiResponse<Map<String, String>>> statusBatchFull(
            @RequestBody java.util.List<String> homeworkIds,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(service.statusForUser(homeworkIds, userId)));
    }
}
