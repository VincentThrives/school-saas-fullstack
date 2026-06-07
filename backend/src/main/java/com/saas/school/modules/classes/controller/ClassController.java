package com.saas.school.modules.classes.controller;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.classes.dto.CreateSubjectRequest;
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
    public ResponseEntity<ApiResponse<Subject>> createSubject(@RequestBody CreateSubjectRequest req) {
        validateSubject(req);
        req.setSubjectId(UUID.randomUUID().toString());
        if (req.getPassRule() == null) req.setPassRule(Subject.PassRule.PER_COMPONENT);
        defaultComponentValues(req);
        Subject saved = subjectRepo.save(req);
        // Auto-attach the new subject to the relevant sections of its class
        // so the admin doesn't have to follow up with a separate "edit class"
        // step. This is what breaks the old class<->subject chicken-and-egg
        // (the class can be created with empty section.subjectIds and the
        // subjects fill in here as they're created).
        attachSubjectToClassSections(saved.getSubjectId(), saved.getClassId(),
                req.getApplyToSectionIds());
        return ResponseEntity.ok(ApiResponse.success(saved, "Created"));
    }

    @PutMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Subject>> updateSubject(
            @PathVariable String subjectId,
            @RequestBody CreateSubjectRequest req) {
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
        Subject saved = subjectRepo.save(existing);
        // Re-apply the section assignment on update too. If the admin
        // changed applyToSectionIds, sections that no longer include
        // the subject lose it; sections newly listed gain it.
        if (req.getApplyToSectionIds() != null) {
            reconcileSubjectOnClassSections(saved.getSubjectId(), saved.getClassId(),
                    req.getApplyToSectionIds());
        }
        return ResponseEntity.ok(ApiResponse.success(saved, "Updated"));
    }

    @DeleteMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteSubject(@PathVariable String subjectId) {
        // Strip the dangling subjectId out of every class section before
        // deleting the document, so no stale ids linger in section
        // subjectIds arrays — the existing /subjects DELETE endpoint near
        // the top of this controller doesn't do this cleanup.
        detachSubjectFromAllClasses(subjectId);
        subjectRepo.deleteById(subjectId);
        return ResponseEntity.ok(ApiResponse.success(null, "Subject deleted"));
    }

    // ── Subject ↔ Class section sync helpers ───────────────────────

    /**
     * Push {@code subjectId} into the {@code subjectIds} list of the
     * given class's sections.
     *
     * <p>If {@code applyToSectionIds} is null or empty, the subject
     * attaches to ALL sections of the class — that's the common case
     * (admin wants the subject everywhere). Otherwise only the listed
     * sections get the subject.
     */
    private void attachSubjectToClassSections(String subjectId, String classId,
                                              java.util.List<String> applyToSectionIds) {
        if (subjectId == null || classId == null) return;
        SchoolClass cls = classRepo.findById(classId).orElse(null);
        if (cls == null || cls.getSections() == null) return;

        boolean attachToAll = applyToSectionIds == null || applyToSectionIds.isEmpty();
        java.util.Set<String> targetSet = attachToAll
                ? null
                : new java.util.HashSet<>(applyToSectionIds);

        boolean changed = false;
        for (SchoolClass.Section sec : cls.getSections()) {
            if (!attachToAll && !targetSet.contains(sec.getSectionId())) continue;
            java.util.List<String> ids = sec.getSubjectIds() == null
                    ? new java.util.ArrayList<>()
                    : new java.util.ArrayList<>(sec.getSubjectIds());
            if (!ids.contains(subjectId)) {
                ids.add(subjectId);
                sec.setSubjectIds(ids);
                changed = true;
            }
        }
        if (changed) classRepo.save(cls);
    }

    /**
     * On subject update: make the class's sections match {@code
     * applyToSectionIds} exactly — listed sections gain the subject if
     * missing, unlisted sections lose it if present.
     */
    private void reconcileSubjectOnClassSections(String subjectId, String classId,
                                                 java.util.List<String> applyToSectionIds) {
        if (subjectId == null || classId == null) return;
        SchoolClass cls = classRepo.findById(classId).orElse(null);
        if (cls == null || cls.getSections() == null) return;
        java.util.Set<String> targetSet = new java.util.HashSet<>(applyToSectionIds);

        boolean changed = false;
        for (SchoolClass.Section sec : cls.getSections()) {
            java.util.List<String> ids = sec.getSubjectIds() == null
                    ? new java.util.ArrayList<>()
                    : new java.util.ArrayList<>(sec.getSubjectIds());
            boolean shouldHave = targetSet.contains(sec.getSectionId());
            boolean does = ids.contains(subjectId);
            if (shouldHave && !does) { ids.add(subjectId); sec.setSubjectIds(ids); changed = true; }
            else if (!shouldHave && does) { ids.remove(subjectId); sec.setSubjectIds(ids); changed = true; }
        }
        if (changed) classRepo.save(cls);
    }

    /**
     * Walk every class in the tenant and remove {@code subjectId} from
     * each section's {@code subjectIds}. Called before deleting a
     * Subject so no dangling ids remain.
     */
    private void detachSubjectFromAllClasses(String subjectId) {
        if (subjectId == null) return;
        for (SchoolClass cls : classRepo.findAll()) {
            if (cls.getSections() == null) continue;
            boolean changed = false;
            for (SchoolClass.Section sec : cls.getSections()) {
                if (sec.getSubjectIds() == null) continue;
                if (sec.getSubjectIds().remove(subjectId)) changed = true;
            }
            if (changed) classRepo.save(cls);
        }
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

}
