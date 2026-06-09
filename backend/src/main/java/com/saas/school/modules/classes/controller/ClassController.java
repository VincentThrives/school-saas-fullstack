package com.saas.school.modules.classes.controller;

import com.saas.school.common.exception.BusinessException;
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
        validateUniqueClassAndSections(req, null);
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
        validateUniqueClassAndSections(req, classId);
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

    /**
     * Reject duplicate classes and duplicate sections-within-a-class
     * BEFORE we hit the persist step.
     *
     * <p>Two checks:</p>
     * <ol>
     *   <li><b>Class uniqueness</b>: the same (name, academicYearId) can't
     *       exist twice for this tenant. Names are compared case-
     *       insensitively + trimmed so "1st" / "1ST" / " 1st " all
     *       collide. On UPDATE we exclude the row being edited so a save
     *       that doesn't change the name still passes.</li>
     *   <li><b>Section uniqueness</b>: within a class, two sections can't
     *       share a name. "A" / "a" / " A " collide. Catches the common
     *       "I created A by accident and re-typed A" mistake on the
     *       Add/Edit Class form.</li>
     * </ol>
     *
     * @param req         the incoming class payload
     * @param editingId   the classId being updated, or {@code null} when
     *                    we're creating a new class
     */
    private void validateUniqueClassAndSections(SchoolClass req, String editingId) {
        if (req == null) throw new BusinessException("Class payload is required.");
        String name = req.getName() == null ? "" : req.getName().trim();
        if (name.isBlank()) throw new BusinessException("Class name is required.");
        String year = req.getAcademicYearId() == null ? "" : req.getAcademicYearId().trim();
        if (year.isBlank()) throw new BusinessException("Academic year is required.");

        // Class-level uniqueness: same name + same year → reject.
        List<SchoolClass> existingInYear = classRepo.findByAcademicYearId(year);
        for (SchoolClass other : existingInYear) {
            if (other == null) continue;
            if (editingId != null && editingId.equals(other.getClassId())) continue; // self
            if (other.getName() != null
                    && other.getName().trim().equalsIgnoreCase(name)) {
                throw new BusinessException(
                        "Class \"" + name + "\" already exists for this academic year.");
            }
        }

        // Section-level uniqueness within THIS class payload — catches
        // the admin typing the same letter twice on the form before
        // it ever reaches storage.
        if (req.getSections() != null) {
            java.util.Set<String> seen = new java.util.HashSet<>();
            for (SchoolClass.Section s : req.getSections()) {
                if (s == null) continue;
                String sname = s.getName() == null ? "" : s.getName().trim();
                if (sname.isBlank()) {
                    throw new BusinessException("Every section needs a name.");
                }
                String key = sname.toLowerCase(java.util.Locale.ROOT);
                if (!seen.add(key)) {
                    throw new BusinessException(
                            "Section \"" + sname + "\" appears twice — section names must be unique within a class.");
                }
            }
        }
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
        normaliseAssignmentsFromLegacyFields(req);
        validateSubject(req);
        validateAssignments(req);
        assertUniqueSubjectName(req.getName(), req.getAcademicYearId(), null);
        req.setSubjectId(UUID.randomUUID().toString());
        if (req.getPassRule() == null) req.setPassRule(Subject.PassRule.PER_COMPONENT);
        defaultComponentValues(req);
        // Wipe the deprecated single-class field on new docs — the
        // assignments array is the only source of truth going forward.
        // We keep it null in storage so the migration runner doesn't
        // accidentally re-process this doc.
        req.setClassId(null);
        Subject saved = subjectRepo.save(req);
        // Auto-attach the new subject into each assigned class's
        // section.subjectIds arrays — so the per-section pickers on
        // Class edit immediately reflect what's been created.
        for (Subject.Assignment a : saved.getAssignments()) {
            attachSubjectToClassSections(saved.getSubjectId(), a.getClassId(), a.getSectionIds());
        }
        return ResponseEntity.ok(ApiResponse.success(saved, "Created"));
    }

    @PutMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Subject>> updateSubject(
            @PathVariable String subjectId,
            @RequestBody CreateSubjectRequest req) {
        normaliseAssignmentsFromLegacyFields(req);
        validateSubject(req);
        validateAssignments(req);
        Subject existing = subjectRepo.findById(subjectId)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));
        assertUniqueSubjectName(req.getName(), req.getAcademicYearId(), subjectId);
        existing.setName(req.getName());
        existing.setCode(req.getCode());
        existing.setAcademicYearId(req.getAcademicYearId());
        existing.setPassRule(req.getPassRule() == null ? Subject.PassRule.PER_COMPONENT : req.getPassRule());
        existing.setComponents(req.getComponents());
        defaultComponentValues(existing);

        // Compute the diff between the OLD assignments (what the
        // subject is currently attached to in class sections) and the
        // new request, so we can reconcile both directions:
        //   - classes that disappear from assignments lose the subject
        //   - classes that appear gain it
        //   - classes that stay get their section list reconciled
        java.util.Map<String, java.util.List<String>> oldByClass = assignmentsToMap(existing.getAssignments());
        java.util.Map<String, java.util.List<String>> newByClass = assignmentsToMap(req.getAssignments());

        // Detach from classes that are no longer in the new assignments.
        for (String classId : oldByClass.keySet()) {
            if (!newByClass.containsKey(classId)) {
                detachSubjectFromClass(subjectId, classId);
            }
        }
        // Reconcile classes that remain or are newly added.
        for (java.util.Map.Entry<String, java.util.List<String>> e : newByClass.entrySet()) {
            reconcileSubjectOnClassSections(subjectId, e.getKey(), e.getValue());
        }

        existing.setAssignments(req.getAssignments());
        existing.setClassId(null);
        Subject saved = subjectRepo.save(existing);
        return ResponseEntity.ok(ApiResponse.success(saved, "Updated"));
    }

    @DeleteMapping("/subjects/{subjectId}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteSubject(@PathVariable String subjectId) {
        // Strip the dangling subjectId out of every class section
        // before deleting the document.
        detachSubjectFromAllClasses(subjectId);
        subjectRepo.deleteById(subjectId);
        return ResponseEntity.ok(ApiResponse.success(null, "Subject deleted"));
    }

    // ── Backward-compat: accept the legacy (classId + applyToSectionIds) DTO ─

    /**
     * If the caller sent the old single-class shape (classId +
     * applyToSectionIds) but no assignments array, fold the two fields
     * into a single-entry assignments array so the rest of the pipeline
     * only deals with one shape. Old API clients keep working.
     */
    @SuppressWarnings("deprecation")
    private void normaliseAssignmentsFromLegacyFields(CreateSubjectRequest req) {
        boolean hasAssignments = req.getAssignments() != null && !req.getAssignments().isEmpty();
        if (hasAssignments) return;
        String legacyClassId = req.getClassId();
        if (legacyClassId == null || legacyClassId.isBlank()) return;
        java.util.List<Subject.Assignment> a = new java.util.ArrayList<>();
        a.add(new Subject.Assignment(legacyClassId, req.getApplyToSectionIds()));
        req.setAssignments(a);
    }

    /** Validate each assignment carries a classId. Sections may be empty. */
    private void validateAssignments(Subject req) {
        if (req.getAssignments() == null || req.getAssignments().isEmpty()) {
            throw new IllegalArgumentException("Subject must be assigned to at least one class");
        }
        for (Subject.Assignment a : req.getAssignments()) {
            if (a.getClassId() == null || a.getClassId().isBlank()) {
                throw new IllegalArgumentException("Each assignment must specify a classId");
            }
        }
    }

    private static java.util.Map<String, java.util.List<String>> assignmentsToMap(
            java.util.List<Subject.Assignment> list) {
        java.util.Map<String, java.util.List<String>> m = new java.util.HashMap<>();
        if (list == null) return m;
        for (Subject.Assignment a : list) {
            m.put(a.getClassId(), a.getSectionIds() == null
                    ? java.util.Collections.emptyList()
                    : a.getSectionIds());
        }
        return m;
    }

    /** Remove the subjectId from every section of the given class. */
    private void detachSubjectFromClass(String subjectId, String classId) {
        if (subjectId == null || classId == null) return;
        SchoolClass cls = classRepo.findById(classId).orElse(null);
        if (cls == null || cls.getSections() == null) return;
        boolean changed = false;
        for (SchoolClass.Section sec : cls.getSections()) {
            if (sec.getSubjectIds() == null) continue;
            if (sec.getSubjectIds().remove(subjectId)) changed = true;
        }
        if (changed) classRepo.save(cls);
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
        // classId is no longer required on the body — assignments[].classId
        // carries that info now. validateAssignments() enforces it.
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
     * Enforce one Subject per name per academic year. Without this rule
     * the admin can create two "Mathematics" docs that mostly differ in
     * class assignments — and downstream pickers (Teacher Assignment
     * Subject dropdown, Exam form) show identical labels with no way to
     * tell them apart. Match is case- and whitespace-insensitive.
     *
     * @param name           the incoming subject name (trimmed before query)
     * @param academicYearId the year we're checking within
     * @param ignoreId       subjectId of the doc being updated (so an edit
     *                       that doesn't rename doesn't trip on itself);
     *                       null for create.
     */
    private void assertUniqueSubjectName(String name, String academicYearId, String ignoreId) {
        if (name == null || name.isBlank() || academicYearId == null || academicYearId.isBlank()) return;
        String trimmed = name.trim();
        // Anchor + escape to make this a whole-name match (no "Math" hitting "Mathematics").
        String regex = "^" + java.util.regex.Pattern.quote(trimmed) + "$";
        List<Subject> hits = subjectRepo.findByNameRegexAndAcademicYearId(regex, academicYearId);
        for (Subject other : hits) {
            if (ignoreId != null && ignoreId.equals(other.getSubjectId())) continue;
            throw new IllegalArgumentException(
                    "Subject '" + trimmed + "' already exists for this academic year. "
                  + "Edit the existing entry to add more class–section assignments instead of creating a duplicate.");
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
