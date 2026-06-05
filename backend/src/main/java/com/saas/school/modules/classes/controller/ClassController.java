package com.saas.school.modules.classes.controller;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Tag(name = "Classes & Subjects")
@RestController
@RequestMapping("/api/v1")
public class ClassController {

    @Autowired private SchoolClassRepository classRepo;
    @Autowired private SubjectRepository subjectRepo;

    @GetMapping("/classes")
    public ResponseEntity<ApiResponse<List<SchoolClass>>> listClasses(
            @RequestParam(required = false) String academicYearId) {
        List<SchoolClass> classes = academicYearId != null
                ? classRepo.findByAcademicYearId(academicYearId)
                : classRepo.findAll();
        return ResponseEntity.ok(ApiResponse.success(classes));
    }

    @GetMapping("/classes/{classId}")
    public ResponseEntity<ApiResponse<SchoolClass>> getClassById(@PathVariable String classId) {
        SchoolClass cls = classRepo.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        return ResponseEntity.ok(ApiResponse.success(cls));
    }

    @PostMapping("/classes")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolClass>> createClass(@RequestBody SchoolClass req) {
        req.setClassId(UUID.randomUUID().toString());
        if (req.getSections() != null) {
            req.getSections().forEach(s -> {
                if (s.getSectionId() == null) s.setSectionId(UUID.randomUUID().toString());
            });
        }
        return ResponseEntity.ok(ApiResponse.success(classRepo.save(req), "Created"));
    }

    @PutMapping("/classes/{classId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<SchoolClass>> updateClass(
            @PathVariable String classId, @RequestBody SchoolClass req) {
        classRepo.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        req.setClassId(classId);
        // Generate sectionId for new sections
        if (req.getSections() != null) {
            req.getSections().forEach(s -> {
                if (s.getSectionId() == null || s.getSectionId().isBlank()) {
                    s.setSectionId(UUID.randomUUID().toString());
                }
            });
        }
        return ResponseEntity.ok(ApiResponse.success(classRepo.save(req), "Updated"));
    }

    @DeleteMapping("/classes/{classId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteClass(@PathVariable String classId) {
        classRepo.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        classRepo.deleteById(classId);
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }

    @GetMapping("/subjects")
    public ResponseEntity<ApiResponse<List<Subject>>> listSubjects(
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String academicYearId,
            @RequestParam(required = false) List<String> ids) {
        List<Subject> subjects;
        if (ids != null && !ids.isEmpty()) {
            subjects = subjectRepo.findBySubjectIdIn(ids);
        } else if (classId != null && academicYearId != null) {
            subjects = subjectRepo.findByClassIdAndAcademicYearId(classId, academicYearId);
        } else {
            subjects = subjectRepo.findAll();
        }
        return ResponseEntity.ok(ApiResponse.success(subjects));
    }

    @PostMapping("/subjects")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Subject>> createSubject(@RequestBody Subject req) {
        validateSubject(req);
        req.setSubjectId(UUID.randomUUID().toString());
        if (req.getPassRule() == null) req.setPassRule(Subject.PassRule.PER_COMPONENT);
        defaultComponentValues(req);
        return ResponseEntity.ok(ApiResponse.success(subjectRepo.save(req), "Created"));
    }

    @PutMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Subject>> updateSubject(
            @PathVariable String subjectId,
            @RequestBody Subject req) {
        validateSubject(req);
        Subject existing = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));
        existing.setName(req.getName());
        existing.setCode(req.getCode());
        existing.setClassId(req.getClassId());
        existing.setAcademicYearId(req.getAcademicYearId());
        existing.setPassRule(req.getPassRule() == null ? Subject.PassRule.PER_COMPONENT : req.getPassRule());
        existing.setComponents(req.getComponents());
        defaultComponentValues(existing);
        return ResponseEntity.ok(ApiResponse.success(subjectRepo.save(existing), "Updated"));
    }

    // ── Subject validation helpers ─────────────────────────────────

    /**
     * Reject malformed subjects up front so the rest of the system
     * can assume every Subject in the DB has at least one component
     * with sensible marks and a unique component key.
     */
    private void validateSubject(Subject req) {
        if (req.getName() == null || req.getName().isBlank()) {
            throw new IllegalArgumentException("Subject name is required");
        }
        if (req.getClassId() == null || req.getClassId().isBlank()) {
            throw new IllegalArgumentException("classId is required");
        }
        if (req.getAcademicYearId() == null || req.getAcademicYearId().isBlank()) {
            throw new IllegalArgumentException("academicYearId is required");
        }
        List<Subject.Component> comps = req.getComponents();
        if (comps == null || comps.isEmpty()) {
            throw new IllegalArgumentException("Subject must have at least one component");
        }
        java.util.Set<String> seenKeys = new java.util.HashSet<>();
        for (Subject.Component c : comps) {
            if (c.getKey() == null || c.getKey().isBlank()) {
                throw new IllegalArgumentException("Each component must have a key");
            }
            if (!seenKeys.add(c.getKey())) {
                throw new IllegalArgumentException("Duplicate component key: " + c.getKey());
            }
            if (c.getLabel() == null || c.getLabel().isBlank()) {
                throw new IllegalArgumentException("Component '" + c.getKey() + "' must have a label");
            }
            if (c.getMaxMarks() == null || c.getMaxMarks() < 0) {
                throw new IllegalArgumentException("Component '" + c.getKey() + "' maxMarks must be >= 0");
            }
            if (c.getPassMarks() == null || c.getPassMarks() < 0 || c.getPassMarks() > c.getMaxMarks()) {
                throw new IllegalArgumentException(
                        "Component '" + c.getKey() + "' passMarks must be between 0 and maxMarks");
            }
            if (c.getAssessmentMode() == null) {
                throw new IllegalArgumentException(
                        "Component '" + c.getKey() + "' must specify an assessmentMode");
            }
            // internalSchedule only meaningful for INTERNAL mode; ignore otherwise.
            if (c.getAssessmentMode() == Subject.AssessmentMode.INTERNAL
                    && c.getInternalSchedule() == null) {
                // Default to PER_TERM rather than rejecting — matches CBSE behaviour
                // and the form's default. defaultComponentValues() applies it.
            }
        }
    }

    /**
     * Fill in defaults Mongo would otherwise persist as null. Keeps
     * downstream services from having to null-check the schedule on
     * every INTERNAL component.
     */
    private void defaultComponentValues(Subject subject) {
        if (subject.getComponents() == null) return;
        for (Subject.Component c : subject.getComponents()) {
            if (c.getAssessmentMode() == Subject.AssessmentMode.INTERNAL
                    && c.getInternalSchedule() == null) {
                c.setInternalSchedule(Subject.InternalSchedule.PER_TERM);
            }
        }
    }

    @DeleteMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteSubject(@PathVariable String subjectId) {
        subjectRepo.deleteById(subjectId);
        return ResponseEntity.ok(ApiResponse.success(null, "Subject deleted"));
    }
}
