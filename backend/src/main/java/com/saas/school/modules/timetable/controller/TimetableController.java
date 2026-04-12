package com.saas.school.modules.timetable.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.timetable.model.Timetable;
import com.saas.school.modules.timetable.repository.TimetableRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
@Tag(name="Timetable")
@RestController
@RequestMapping("/api/v1/timetable")
public class TimetableController {
    @Autowired private TimetableRepository timetableRepo;

    @GetMapping
    public ResponseEntity<ApiResponse<Timetable>> get(
            @RequestParam String classId,
            @RequestParam String sectionId,
            @RequestParam String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(
            timetableRepo.findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId)
                .orElse(null)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Timetable>> create(@RequestBody Timetable req) {
        req.setTimetableId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(timetableRepo.save(req), "Created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Timetable>> update(
            @PathVariable String id, @RequestBody Timetable req) {
        req.setTimetableId(id);
        return ResponseEntity.ok(ApiResponse.success(timetableRepo.save(req)));
    }
}