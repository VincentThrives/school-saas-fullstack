package com.saas.school.modules.mentoring.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.mentoring.model.MentoringNote;
import com.saas.school.modules.mentoring.repository.MentoringNoteRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*; 
@Tag(name="Mentoring")
@RestController
@RequestMapping("/api/v1/students/{studentId}/mentoring-notes")
public class MentoringController {
    @Autowired private MentoringNoteRepository noteRepo;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<MentoringNote>>> list(@PathVariable String studentId) {
        return ResponseEntity.ok(ApiResponse.success(noteRepo.findByStudentId(studentId)));
    }
    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<MentoringNote>> create(
            @PathVariable String studentId,
            @RequestBody MentoringNote req,
            @AuthenticationPrincipal String userId) {
        req.setNoteId(UUID.randomUUID().toString());
        req.setStudentId(studentId);
        req.setTeacherId(userId);
        return ResponseEntity.ok(ApiResponse.success(noteRepo.save(req), "Note added"));
    }
}