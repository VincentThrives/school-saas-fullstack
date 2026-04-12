package com.saas.school.modules.ptm.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.ptm.dto.BookSlotRequest;
import com.saas.school.modules.ptm.dto.CreatePtmRequest;
import com.saas.school.modules.ptm.model.PtmSchedule;
import com.saas.school.modules.ptm.model.PtmSlot;
import com.saas.school.modules.ptm.service.PtmService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "PTM")
@RestController
@RequestMapping("/api/v1/ptm")
public class PtmController {

    @Autowired
    private PtmService ptmService;

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<PtmSchedule>> create(
            @RequestBody CreatePtmRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                ptmService.createSchedule(req, userId), "PTM schedule created"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PtmSchedule>>> list() {
        return ResponseEntity.ok(ApiResponse.success(ptmService.getSchedules()));
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<PtmSchedule>> publish(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                ptmService.publishSchedule(id), "PTM schedule published"));
    }

    @GetMapping("/{scheduleId}/slots")
    public ResponseEntity<ApiResponse<List<PtmSlot>>> getSlots(
            @PathVariable String scheduleId,
            @RequestParam(required = false) String teacherId) {
        return ResponseEntity.ok(ApiResponse.success(
                ptmService.getAvailableSlots(scheduleId, teacherId)));
    }

    @PostMapping("/slots/{slotId}/book")
    @PreAuthorize("hasRole('PARENT')")
    public ResponseEntity<ApiResponse<PtmSlot>> bookSlot(
            @PathVariable String slotId,
            @RequestBody BookSlotRequest req,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                ptmService.bookSlot(slotId, userId, null, req.getStudentId(), null),
                "Slot booked successfully"));
    }

    @DeleteMapping("/slots/{slotId}/cancel")
    @PreAuthorize("hasRole('PARENT')")
    public ResponseEntity<ApiResponse<PtmSlot>> cancelSlot(
            @PathVariable String slotId,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(
                ptmService.cancelSlot(slotId, userId), "Booking cancelled"));
    }

    @GetMapping("/my-schedule")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<List<PtmSlot>>> mySchedule(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(ptmService.getTeacherSchedule(userId)));
    }

    @GetMapping("/my-bookings")
    @PreAuthorize("hasRole('PARENT')")
    public ResponseEntity<ApiResponse<List<PtmSlot>>> myBookings(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(ptmService.getParentBookings(userId)));
    }
}
