package com.saas.school.modules.event.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.service.NotificationRuleEngine;
import com.saas.school.modules.notification.service.NotificationRuleEngine.FirePayload;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "Events & Holidays")
@RestController
@RequestMapping("/api/v1/events")
public class EventController {
    private static final Logger log = LoggerFactory.getLogger(EventController.class);

    @Autowired private SchoolEventRepository eventRepo;
    @Autowired private AcademicYearRepository academicYearRepo;
    @Autowired private NotificationRuleEngine ruleEngine;

    // ── Helpers ───────────────────────────────────────────────────────────

    private Optional<String> resolveAcademicYearId(LocalDate date) {
        if (date == null) return Optional.empty();
        return academicYearRepo.findContaining(date).map(AcademicYear::getAcademicYearId);
    }

    /** Populate derived fields before saving. */
    private void applyDerivedFields(SchoolEvent e) {
        if (e.getStartDate() != null) {
            e.setYear(e.getStartDate().getYear());
            e.setMonth(e.getStartDate().getMonthValue());
            if (e.getAcademicYearId() == null || e.getAcademicYearId().isBlank()) {
                resolveAcademicYearId(e.getStartDate()).ifPresent(e::setAcademicYearId);
            }
        }
    }

    /** Compute the effective academicYearId for an event, stored or derived. */
    private String effectiveAcademicYearId(SchoolEvent e) {
        if (e.getAcademicYearId() != null && !e.getAcademicYearId().isBlank()) {
            return e.getAcademicYearId();
        }
        return resolveAcademicYearId(e.getStartDate()).orElse(null);
    }

    /** Compute the effective month (1..12) for an event, stored or derived. */
    private Integer effectiveMonth(SchoolEvent e) {
        if (e.getMonth() != null) return e.getMonth();
        return e.getStartDate() != null ? e.getStartDate().getMonthValue() : null;
    }

    /** Compute the effective year for an event, stored or derived. */
    private Integer effectiveYear(SchoolEvent e) {
        if (e.getYear() != null) return e.getYear();
        return e.getStartDate() != null ? e.getStartDate().getYear() : null;
    }

    /**
     * Lazy backfill: while we have a live tenant context, persist derived
     * fields for any legacy document that still has them null. One-time cost
     * per doc.
     */
    private void backfillIfNeeded(Collection<SchoolEvent> events) {
        int fixed = 0;
        for (SchoolEvent e : events) {
            if (e.getStartDate() == null) continue;
            boolean changed = false;
            if (e.getYear() == null) { e.setYear(e.getStartDate().getYear()); changed = true; }
            if (e.getMonth() == null) { e.setMonth(e.getStartDate().getMonthValue()); changed = true; }
            if (e.getAcademicYearId() == null) {
                String ayId = resolveAcademicYearId(e.getStartDate()).orElse(null);
                if (ayId != null) { e.setAcademicYearId(ayId); changed = true; }
            }
            if (changed) { eventRepo.save(e); fixed++; }
        }
        if (fixed > 0) log.info("Backfilled academicYearId/year/month for {} event(s)", fixed);
    }

    /**
     * Apply all optional filters in Java. Falls back to values derived from
     * startDate whenever stored fields are missing, so legacy docs still match.
     */
    private List<SchoolEvent> filterInJava(List<SchoolEvent> events,
                                           String academicYearId,
                                           Integer year,
                                           Integer month,
                                           LocalDate from,
                                           LocalDate to) {
        return events.stream().filter(e -> {
            if (academicYearId != null && !academicYearId.isBlank()) {
                String effective = effectiveAcademicYearId(e);
                if (effective == null || !effective.equals(academicYearId)) return false;
            }
            if (year != null) {
                Integer ey = effectiveYear(e);
                if (ey == null || !ey.equals(year)) return false;
            }
            if (month != null) {
                Integer em = effectiveMonth(e);
                if (em == null || !em.equals(month)) return false;
            }
            if (from != null && e.getEndDate() != null && e.getEndDate().isBefore(from)) return false;
            if (to != null && e.getStartDate() != null && e.getStartDate().isAfter(to)) return false;
            return true;
        }).collect(Collectors.toList());
    }

    // ── Endpoints ────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<List<SchoolEvent>>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        List<SchoolEvent> all = eventRepo.findAll();
        backfillIfNeeded(all);
        List<SchoolEvent> filtered = filterInJava(all, academicYearId, year, month, from, to);
        return ResponseEntity.ok(ApiResponse.success(filtered));
    }

    @GetMapping("/holidays")
    public ResponseEntity<ApiResponse<List<SchoolEvent>>> holidays(
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month) {
        List<SchoolEvent> all = eventRepo.findByIsHolidayTrue();
        backfillIfNeeded(all);
        List<SchoolEvent> filtered = filterInJava(all, academicYearId, year, month, null, null);
        return ResponseEntity.ok(ApiResponse.success(filtered));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolEvent>> create(
            @RequestBody SchoolEvent req, @AuthenticationPrincipal String userId) {
        req.setEventId(UUID.randomUUID().toString());
        req.setCreatedBy(userId);
        applyDerivedFields(req);
        SchoolEvent saved = eventRepo.save(req);

        // Fire HOLIDAY_DECLARED to everyone when a holiday is created.
        if (saved.isHoliday()) {
            Map<String, Object> vars = new HashMap<>();
            vars.put("title", saved.getTitle() != null ? saved.getTitle() : "Holiday");
            vars.put("date",  saved.getStartDate() != null ? saved.getStartDate().toString() : "");
            ruleEngine.fire("HOLIDAY_DECLARED", FirePayload.toAll()
                    .entityId(saved.getEventId())
                    .type(Notification.NotificationType.ANNOUNCEMENT)
                    .vars(vars)
                    .fallback("Holiday declared — " + vars.get("title"),
                            "The school will be closed on " + vars.get("date") + " — " + vars.get("title") + "."));
        }
        return ResponseEntity.ok(ApiResponse.success(saved, "Created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolEvent>> update(
            @PathVariable String id, @RequestBody SchoolEvent req) {
        req.setEventId(id);
        // Always recompute from the (possibly changed) startDate.
        req.setAcademicYearId(null);
        applyDerivedFields(req);
        return ResponseEntity.ok(ApiResponse.success(eventRepo.save(req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        eventRepo.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }
}
