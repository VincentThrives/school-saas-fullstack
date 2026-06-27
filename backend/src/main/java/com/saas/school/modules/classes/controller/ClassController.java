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
        normaliseSectionNames(req);
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
        normaliseSectionNames(req);
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
     * Force section names to UPPERCASE on every class save so "a"/"A"/" a "
     * always lands as "A". Keeps the SMS recipient body, exam config picker,
     * and student admission lists visually consistent across the app.
     */
    private void normaliseSectionNames(SchoolClass req) {
        if (req == null || req.getSections() == null) return;
        for (SchoolClass.Section s : req.getSections()) {
            if (s == null || s.getName() == null) continue;
            String trimmed = s.getName().trim();
            if (!trimmed.isEmpty()) s.setName(trimmed.toUpperCase(java.util.Locale.ROOT));
        }
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
        assertNoOverlappingAssignment(req.getName(), req.getAcademicYearId(), req.getAssignments(), null);
        if (req.getPassRule() == null) req.setPassRule(Subject.PassRule.PER_COMPONENT);
        defaultComponentValues(req);

        // Auto-merge path: if a same-named doc already exists in this
        // academic year AND BOTH its components AND its sub-parts list
        // match what we're creating, fold the new class+section
        // assignments into that doc instead of spawning a near-duplicate.
        // Sub-parts is part of the identity now — a Science (no sub-parts)
        // create must NOT collapse into a pre-existing Science (with sub-
        // parts) doc, otherwise 8th-class teachers inherit a sub-part
        // picker they never asked for.
        Subject mergeTarget = findIdenticalShapeSubject(
                req.getName(), req.getAcademicYearId(),
                req.getComponents(), req.getSubParts());
        if (mergeTarget != null) {
            mergeAssignmentsInto(mergeTarget, req.getAssignments());
            mergeTarget.setClassId(null);
            Subject saved = subjectRepo.save(mergeTarget);
            for (Subject.Assignment a : req.getAssignments()) {
                attachSubjectToClassSections(saved.getSubjectId(), a.getClassId(), a.getSectionIds());
            }
            return ResponseEntity.ok(ApiResponse.success(saved,
                    "Added class–section to existing '" + saved.getName() + "' (same components)."));
        }

        req.setSubjectId(UUID.randomUUID().toString());
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
        assertNoOverlappingAssignment(req.getName(), req.getAcademicYearId(), req.getAssignments(), subjectId);
        existing.setName(req.getName());
        existing.setCode(req.getCode());
        existing.setAcademicYearId(req.getAcademicYearId());
        existing.setPassRule(req.getPassRule() == null ? Subject.PassRule.PER_COMPONENT : req.getPassRule());
        existing.setComponents(req.getComponents());
        // Without these two lines the combined-period toggle (PE /
        // Assembly / Drill) and the sub-parts list (Physics /
        // Chemistry / Biology under Science) silently no-op on
        // update — the request carries the new value but the
        // controller never copies it onto `existing` before save.
        existing.setGroupPeriodAllowed(req.isGroupPeriodAllowed());
        existing.setSubParts(req.getSubParts());
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
            // Marks (max + pass) are no longer required on Subject — they
            // live on the Exam doc now, so admin can run UT1 at 40+10 and
            // Final at 80+20 for the same Math · Theory component. If the
            // request still sends them (legacy clients), keep them sane.
            if (c.getMaxMarks() != null && c.getMaxMarks() < 0) {
                throw new IllegalArgumentException("Component '" + c.getKey() + "' maxMarks must be >= 0");
            }
            if (c.getPassMarks() != null
                    && (c.getPassMarks() < 0
                        || (c.getMaxMarks() != null && c.getPassMarks() > c.getMaxMarks()))) {
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
     * Reject a Subject if another doc with the same name in the same
     * academic year already claims one of the same (classId, sectionId)
     * pairs. Different classes with the same name are FINE — Class 10
     * Math (Theory only) and Class 11 Math (Theory + Practical) are
     * legitimately separate Subject docs because their components
     * differ. We only block the case where the SAME class+section is
     * mapped to two same-named Subject docs, because the downstream
     * pickers (Teacher Assignment, Exam, Timetable) then show two
     * indistinguishable "Mathematics" entries for that section.
     *
     * @param name           the incoming subject name (trimmed before query)
     * @param academicYearId the year we're checking within
     * @param newAssignments class+section pairs the new/edited subject claims
     * @param ignoreId       subjectId of the doc being updated (so an edit
     *                       doesn't trip on itself); null for create.
     */
    private void assertNoOverlappingAssignment(
            String name,
            String academicYearId,
            List<Subject.Assignment> newAssignments,
            String ignoreId) {
        if (name == null || name.isBlank() || academicYearId == null || academicYearId.isBlank()) return;
        if (newAssignments == null || newAssignments.isEmpty()) return;
        String trimmed = name.trim();
        String regex = "^" + java.util.regex.Pattern.quote(trimmed) + "$";
        List<Subject> hits = subjectRepo.findByNameRegexAndAcademicYearId(regex, academicYearId);

        // Index the incoming class+section pairs for O(1) probes.
        java.util.Set<String> newPairs = new java.util.HashSet<>();
        java.util.Map<String, String> classLabel = new java.util.HashMap<>();
        for (Subject.Assignment a : newAssignments) {
            if (a == null || a.getClassId() == null || a.getSectionIds() == null) continue;
            for (String secId : a.getSectionIds()) {
                if (secId == null || secId.isBlank()) continue;
                newPairs.add(a.getClassId() + "::" + secId);
            }
        }
        if (newPairs.isEmpty()) return;

        for (Subject other : hits) {
            if (ignoreId != null && ignoreId.equals(other.getSubjectId())) continue;
            if (other.getAssignments() == null) continue;
            for (Subject.Assignment a : other.getAssignments()) {
                if (a == null || a.getClassId() == null || a.getSectionIds() == null) continue;
                for (String secId : a.getSectionIds()) {
                    if (secId == null || secId.isBlank()) continue;
                    String key = a.getClassId() + "::" + secId;
                    if (newPairs.contains(key)) {
                        // Resolve a friendly class+section label for the error.
                        String cls = classRepo.findById(a.getClassId())
                                .map(c -> c.getName()).orElse(a.getClassId());
                        // Section name lookup — fall through to id if class doc is missing.
                        String secName = classRepo.findById(a.getClassId())
                                .flatMap(c -> c.getSections() == null ? java.util.Optional.empty()
                                        : c.getSections().stream()
                                                .filter(s -> secId.equals(s.getSectionId()))
                                                .findFirst()
                                                .map(s -> s.getName()))
                                .orElse(secId);
                        throw new IllegalArgumentException(
                                "Subject '" + trimmed + "' is already mapped to "
                              + cls + " — Section " + secName
                              + " through another entry. Either edit that existing entry to change its components, "
                              + "or pick a different class/section here.");
                    }
                }
            }
        }
    }

    /**
     * Find an existing same-named Subject in this year whose component
     * shape EXACTLY matches the incoming request. "Exactly" means: same
     * set of component keys, each with identical maxMarks, passMarks,
     * assessmentMode, trackAttendance, label. Order-insensitive.
     * Returns null when no such doc exists — caller falls through to
     * "create new doc" path.
     */
    private Subject findIdenticalShapeSubject(
            String name, String academicYearId,
            List<Subject.Component> incomingComponents,
            List<Subject.SubPart> incomingSubParts) {
        if (name == null || name.isBlank() || academicYearId == null || academicYearId.isBlank()) return null;
        if (incomingComponents == null) return null;
        String regex = "^" + java.util.regex.Pattern.quote(name.trim()) + "$";
        List<Subject> hits = subjectRepo.findByNameRegexAndAcademicYearId(regex, academicYearId);
        for (Subject other : hits) {
            if (!componentsEqual(other.getComponents(), incomingComponents)) continue;
            // Sub-parts are part of the shape too — a Science (no sub-parts)
            // and a Science (Physics + Chemistry + Biology sub-parts) are
            // structurally different teaching configurations and must live
            // as separate Subject docs even when components match. Without
            // this check the no-sub-parts create silently folded into the
            // sub-parts doc and 8th-class teachers ended up with sub-part
            // pickers they didn't ask for.
            if (!subPartsEqual(other.getSubParts(), incomingSubParts)) continue;
            return other;
        }
        return null;
    }

    /**
     * Order-insensitive equality on the (key, label, code) tuples of two
     * sub-parts lists. Treats null and empty as equal — "this subject has
     * no sub-parts" should match either representation.
     */
    private boolean subPartsEqual(List<Subject.SubPart> a, List<Subject.SubPart> b) {
        int sizeA = (a == null) ? 0 : a.size();
        int sizeB = (b == null) ? 0 : b.size();
        if (sizeA != sizeB) return false;
        if (sizeA == 0) return true;
        java.util.Map<String, Subject.SubPart> byKey = new java.util.HashMap<>();
        for (Subject.SubPart sp : a) if (sp != null && sp.getKey() != null) byKey.put(sp.getKey(), sp);
        for (Subject.SubPart sp : b) {
            if (sp == null || sp.getKey() == null) return false;
            Subject.SubPart peer = byKey.get(sp.getKey());
            if (peer == null) return false;
            if (!java.util.Objects.equals(peer.getLabel(), sp.getLabel())) return false;
            if (!java.util.Objects.equals(peer.getCode(), sp.getCode())) return false;
        }
        return true;
    }

    /**
     * Order-insensitive equality on the bits of {@link Subject.Component}
     * that actually drive downstream behaviour (marks caps, assessment
     * routing, label shown to parents). Two components with the same key
     * but different maxMarks count as DIFFERENT — Class 10 Math (Theory
     * 100) vs Class 11 Math (Theory 70 + Practical 30) must stay
     * separate docs.
     */
    private boolean componentsEqual(List<Subject.Component> a, List<Subject.Component> b) {
        if (a == null || b == null) return a == b;
        if (a.size() != b.size()) return false;
        java.util.Map<String, Subject.Component> byKey = new java.util.HashMap<>();
        for (Subject.Component c : a) if (c != null && c.getKey() != null) byKey.put(c.getKey(), c);
        for (Subject.Component c : b) {
            if (c == null || c.getKey() == null) return false;
            Subject.Component peer = byKey.get(c.getKey());
            if (peer == null) return false;
            if (!java.util.Objects.equals(peer.getMaxMarks(), c.getMaxMarks())) return false;
            if (!java.util.Objects.equals(peer.getPassMarks(), c.getPassMarks())) return false;
            if (peer.getAssessmentMode() != c.getAssessmentMode()) return false;
            if (peer.isTrackAttendance() != c.isTrackAttendance()) return false;
            if (!java.util.Objects.equals(peer.getLabel(), c.getLabel())) return false;
        }
        return true;
    }

    /**
     * Fold the incoming class+section assignments into an existing
     * Subject. For a class already on the target, merge the section ids
     * (de-duped). For a brand-new class, push a fresh Assignment. The
     * caller still walks the incoming assignments to attach the subject
     * to each class's section.subjectIds list — this method only touches
     * the Subject doc itself.
     */
    private void mergeAssignmentsInto(Subject target, List<Subject.Assignment> incoming) {
        if (incoming == null || incoming.isEmpty()) return;
        if (target.getAssignments() == null) target.setAssignments(new java.util.ArrayList<>());
        java.util.Map<String, Subject.Assignment> byClassId = new java.util.HashMap<>();
        for (Subject.Assignment a : target.getAssignments()) {
            if (a != null && a.getClassId() != null) byClassId.put(a.getClassId(), a);
        }
        for (Subject.Assignment a : incoming) {
            if (a == null || a.getClassId() == null) continue;
            Subject.Assignment existing = byClassId.get(a.getClassId());
            if (existing == null) {
                target.getAssignments().add(a);
                byClassId.put(a.getClassId(), a);
                continue;
            }
            // Merge sectionIds (preserve order, drop dupes).
            java.util.LinkedHashSet<String> merged = new java.util.LinkedHashSet<>();
            if (existing.getSectionIds() != null) merged.addAll(existing.getSectionIds());
            if (a.getSectionIds() != null) merged.addAll(a.getSectionIds());
            existing.setSectionIds(new java.util.ArrayList<>(merged));
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
