package com.saas.school.modules.notification.controller;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.notification.model.NotificationRule;
import com.saas.school.modules.notification.repository.NotificationRuleRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Tag(name = "Notification Rules")
@RestController
@RequestMapping("/api/v1/notification-rules")
@PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL')")
public class NotificationRuleController {

    @Autowired
    private NotificationRuleRepository repo;

    // Factory defaults. Seeded on first GET if the collection is empty.
    private static final List<NotificationRule> DEFAULTS = List.of(
            make("ABSENCE_ALERT",       "Absence alert",          "Sent to parents when a student is marked absent for the day.", "BOTH"),
            make("FEE_DUE",             "Fee due reminder",       "Sent to parents 3 days before a fee due date, and again on the due date.", "BOTH"),
            make("EXAM_REMINDER",       "Exam reminder",          "Sent to students and parents one day before each scheduled exam.", "IN_APP"),
            make("PTM_REMINDER",        "PTM reminder",           "Sent to parents one day before a Parent-Teacher Meeting.", "BOTH"),
            make("LOW_ATTENDANCE",      "Low attendance alert",   "Weekly sweep — if a student's attendance falls below 75%, notify student + parents.", "BOTH"),
            make("REPORT_CARD_READY",   "Report card published",  "Sent to parents when a new report card is generated for their child.", "IN_APP"),
            make("TIMETABLE_CHANGE",    "Timetable updated",      "Sent to affected class and teachers when the timetable is edited.", "IN_APP"),
            make("HOLIDAY_DECLARED",    "Holiday announced",      "Sent to everyone when an admin adds a new holiday in Events.", "IN_APP")
    );

    private static NotificationRule make(String key, String name, String desc, String ch) {
        NotificationRule r = new NotificationRule();
        r.setRuleKey(key);
        r.setName(name);
        r.setDescription(desc);
        r.setChannel(ch);
        r.setDefaultChannel(ch);
        r.setEnabled(false);
        return r;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationRule>>> list() {
        if (repo.count() == 0) seedDefaults();
        return ResponseEntity.ok(ApiResponse.success(repo.findAllByOrderByNameAsc()));
    }

    /** Update an existing rule (enabled flag, channel, linked templateId). */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<NotificationRule>> update(
            @PathVariable String id,
            @RequestBody NotificationRule req) {
        NotificationRule existing = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("NotificationRule", id));
        existing.setEnabled(req.isEnabled());
        if (req.getChannel() != null) existing.setChannel(req.getChannel());
        existing.setTemplateId(req.getTemplateId()); // null allowed to unlink
        return ResponseEntity.ok(ApiResponse.success(repo.save(existing), "Rule updated"));
    }

    /** Restore all rules to their factory defaults (enabled=false, channel=default, template unlinked). */
    @PostMapping("/reset")
    public ResponseEntity<ApiResponse<List<NotificationRule>>> resetAll() {
        repo.deleteAll();
        seedDefaults();
        return ResponseEntity.ok(ApiResponse.success(repo.findAllByOrderByNameAsc(), "Restored defaults"));
    }

    private void seedDefaults() {
        for (NotificationRule r : DEFAULTS) {
            if (repo.existsByRuleKey(r.getRuleKey())) continue;
            NotificationRule copy = new NotificationRule();
            copy.setId(UUID.randomUUID().toString());
            copy.setRuleKey(r.getRuleKey());
            copy.setName(r.getName());
            copy.setDescription(r.getDescription());
            copy.setChannel(r.getChannel());
            copy.setDefaultChannel(r.getDefaultChannel());
            copy.setEnabled(r.isEnabled());
            repo.save(copy);
        }
    }
}
