package com.saas.school.modules.timetable.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.timetable.model.Timetable;
import com.saas.school.modules.timetable.service.TimetableService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Timetable")
@RestController
@RequestMapping("/api/v1/timetable")
public class TimetableController {

    private static final Logger logger = LoggerFactory.getLogger(TimetableController.class);

    @Autowired
    private TimetableService timetableService;

    @GetMapping
    public ResponseEntity<ApiResponse<Timetable>> get(
            @RequestParam String classId,
            @RequestParam String sectionId,
            @RequestParam String academicYearId) {
        logger.info("GET timetable for classId={}, sectionId={}, academicYearId={}", classId, sectionId, academicYearId);
        Timetable timetable = timetableService.getOrCreate(classId, sectionId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(timetable));
    }

    @GetMapping("/list")
    public ResponseEntity<ApiResponse<List<Timetable>>> list(
            @RequestParam String academicYearId) {
        logger.info("GET timetable list for academicYearId={}", academicYearId);
        List<Timetable> timetables = timetableService.getByAcademicYear(academicYearId);
        return ResponseEntity.ok(ApiResponse.success(timetables));
    }

    @GetMapping("/class/{classId}")
    public ResponseEntity<ApiResponse<List<Timetable>>> getByClass(
            @PathVariable String classId,
            @RequestParam String academicYearId) {
        logger.info("GET timetables for classId={}, academicYearId={}", classId, academicYearId);
        List<Timetable> timetables = timetableService.getByClass(classId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(timetables));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Timetable>> create(@RequestBody Timetable req) {
        logger.info("POST create timetable for classId={}, sectionId={}", req.getClassId(), req.getSectionId());
        Timetable saved = timetableService.save(req);
        return ResponseEntity.ok(ApiResponse.success(saved, "Created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Timetable>> update(
            @PathVariable String id, @RequestBody Timetable req) {
        logger.info("PUT update timetable id={}", id);
        req.setTimetableId(id);
        Timetable saved = timetableService.save(req);
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        logger.info("DELETE timetable id={}", id);
        timetableService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }

    @GetMapping("/teacher/{teacherId}")
    public ResponseEntity<ApiResponse<List<Timetable>>> getTeacherSchedule(
            @PathVariable String teacherId,
            @RequestParam String academicYearId) {
        logger.info("GET teacher schedule for teacherId={}, academicYearId={}", teacherId, academicYearId);
        List<Timetable> schedule = timetableService.getTeacherSchedule(teacherId, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(schedule));
    }
}
