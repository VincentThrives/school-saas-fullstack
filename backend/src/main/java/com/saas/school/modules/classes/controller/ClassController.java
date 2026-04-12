package com.saas.school.modules.classes.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*; 
@Tag(name="Classes & Subjects")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ClassController {
    private final SchoolClassRepository classRepo;
    private final SubjectRepository subjectRepo;

    @GetMapping("/classes")
    public ResponseEntity<ApiResponse<List<SchoolClass>>> listClasses(
            @RequestParam(required=false) String academicYearId) {
        List<SchoolClass> classes = academicYearId != null
            ? classRepo.findByAcademicYearId(academicYearId)
            : classRepo.findAll();
        return ResponseEntity.ok(ApiResponse.success(classes));
    }
    @PostMapping("/classes")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolClass>> createClass(@RequestBody SchoolClass req) {
        req.setClassId(UUID.randomUUID().toString());
        if (req.getSections() != null)
            req.getSections().forEach(s -> { if (s.getSectionId()==null) s.setSectionId(UUID.randomUUID().toString()); });
        return ResponseEntity.ok(ApiResponse.success(classRepo.save(req), "Created"));
    }
    @GetMapping("/subjects")
    public ResponseEntity<ApiResponse<List<Subject>>> listSubjects(
            @RequestParam(required=false) String classId,
            @RequestParam(required=false) String academicYearId) {
        List<Subject> subjects = (classId!=null && academicYearId!=null)
            ? subjectRepo.findByClassIdAndAcademicYearId(classId, academicYearId)
            : subjectRepo.findAll();
        return ResponseEntity.ok(ApiResponse.success(subjects));
    }
    @PostMapping("/subjects")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Subject>> createSubject(@RequestBody Subject req) {
        req.setSubjectId(UUID.randomUUID().toString());
        return ResponseEntity.ok(ApiResponse.success(subjectRepo.save(req), "Created"));
    }
}