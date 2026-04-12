package com.saas.school.modules.event.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.event.model.SchoolEvent;
import com.saas.school.modules.event.repository.SchoolEventRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate; import java.util.*; 
@Tag(name="Events & Holidays")
@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class EventController {
    private final SchoolEventRepository eventRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SchoolEvent>>> list(
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to) {
        List<SchoolEvent> events = (from!=null && to!=null)
            ? eventRepo.findByDateRange(from, to) : eventRepo.findAll();
        return ResponseEntity.ok(ApiResponse.success(events));
    }
    @GetMapping("/holidays")
    public ResponseEntity<ApiResponse<List<SchoolEvent>>> holidays() {
        return ResponseEntity.ok(ApiResponse.success(eventRepo.findByIsHolidayTrue()));
    }
    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolEvent>> create(
            @RequestBody SchoolEvent req, @AuthenticationPrincipal String userId) {
        req.setEventId(UUID.randomUUID().toString());
        req.setCreatedBy(userId);
        return ResponseEntity.ok(ApiResponse.success(eventRepo.save(req), "Created"));
    }
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolEvent>> update(
            @PathVariable String id, @RequestBody SchoolEvent req) {
        req.setEventId(id);
        return ResponseEntity.ok(ApiResponse.success(eventRepo.save(req)));
    }
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        eventRepo.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }
}