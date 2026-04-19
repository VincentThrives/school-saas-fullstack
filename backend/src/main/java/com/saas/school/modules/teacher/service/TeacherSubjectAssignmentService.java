package com.saas.school.modules.teacher.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.teacher.dto.CarryForwardAssignmentsRequest;
import com.saas.school.modules.teacher.dto.CreateTeacherAssignmentRequest;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment.Role;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.repository.TeacherSubjectAssignmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * The single source of truth for "which teacher teaches what, in which year".
 * Every feature (syllabus, attendance, timetable, report cards, my-students)
 * that needs this linkage should call THIS service rather than reading
 * Teacher.classSubjectAssignments directly.
 */
@Service
public class TeacherSubjectAssignmentService {

    private static final Logger logger = LoggerFactory.getLogger(TeacherSubjectAssignmentService.class);

    @Autowired private TeacherSubjectAssignmentRepository repo;
    @Autowired private TeacherRepository teacherRepo;
    @Autowired private AcademicYearRepository academicYearRepo;
    @Autowired private SchoolClassRepository schoolClassRepo;

    // ── CRUD ─────────────────────────────────────────────────────────

    public TeacherSubjectAssignment create(CreateTeacherAssignmentRequest req) {
        // De-duplicate (teacher, year, class, section, subject)
        Optional<TeacherSubjectAssignment> existing = repo
                .findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectId(
                        req.getTeacherId(), req.getAcademicYearId(),
                        req.getClassId(), req.getSectionId(), req.getSubjectId());
        if (existing.isPresent()) {
            // Merge roles onto existing row instead of throwing.
            TeacherSubjectAssignment a = existing.get();
            if (req.getRoles() != null) {
                Set<Role> merged = new HashSet<>(a.getRoles() == null ? new HashSet<>() : a.getRoles());
                merged.addAll(req.getRoles());
                a.setRoles(merged);
            }
            a.setStatus(TeacherSubjectAssignment.Status.ACTIVE);
            return repo.save(a);
        }
        TeacherSubjectAssignment a = new TeacherSubjectAssignment();
        a.setAssignmentId(UUID.randomUUID().toString());
        a.setTeacherId(req.getTeacherId());
        a.setAcademicYearId(req.getAcademicYearId());
        a.setClassId(req.getClassId());
        a.setSectionId(req.getSectionId());
        a.setSubjectId(req.getSubjectId());
        a.setRoles(req.getRoles() == null ? Set.of(Role.SUBJECT_TEACHER) : new HashSet<>(req.getRoles()));
        a.setStatus(TeacherSubjectAssignment.Status.ACTIVE);
        return repo.save(a);
    }

    public TeacherSubjectAssignment update(String assignmentId, CreateTeacherAssignmentRequest req) {
        TeacherSubjectAssignment a = repo.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found: " + assignmentId));
        if (req.getClassId() != null) a.setClassId(req.getClassId());
        if (req.getSectionId() != null) a.setSectionId(req.getSectionId());
        if (req.getSubjectId() != null) a.setSubjectId(req.getSubjectId());
        if (req.getAcademicYearId() != null) a.setAcademicYearId(req.getAcademicYearId());
        if (req.getRoles() != null) a.setRoles(new HashSet<>(req.getRoles()));
        return repo.save(a);
    }

    public void delete(String assignmentId) {
        if (!repo.existsById(assignmentId)) {
            throw new ResourceNotFoundException("Assignment not found: " + assignmentId);
        }
        repo.deleteById(assignmentId);
    }

    // ── Reads (canonical API every consumer uses) ────────────────────

    public List<TeacherSubjectAssignment> list(String teacherId, String academicYearId,
                                               String classId, String sectionId) {
        if (teacherId != null && academicYearId != null) {
            return repo.findByTeacherIdAndAcademicYearId(teacherId, academicYearId);
        }
        if (classId != null && sectionId != null && academicYearId != null) {
            return repo.findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId);
        }
        if (classId != null && academicYearId != null) {
            return repo.findByClassIdAndAcademicYearId(classId, academicYearId);
        }
        if (academicYearId != null) return repo.findByAcademicYearId(academicYearId);
        if (teacherId != null) return repo.findByTeacherId(teacherId);
        return repo.findAll();
    }

    public List<TeacherSubjectAssignment> listForTeacher(String teacherId, String academicYearId) {
        lazyMigrateFromLegacyIfNeeded(teacherId, academicYearId);
        if (academicYearId == null) return repo.findByTeacherId(teacherId);
        return repo.findByTeacherIdAndAcademicYearId(teacherId, academicYearId);
    }

    /**
     * Core authorization check used by Syllabus, Subject Attendance, etc.
     * Null on either side of sectionId is treated as a wildcard.
     */
    public boolean canTeach(String teacherId, String academicYearId,
                            String classId, String sectionId, String subjectId) {
        if (teacherId == null || academicYearId == null || classId == null) return false;
        List<TeacherSubjectAssignment> mine = repo.findByTeacherIdAndAcademicYearId(teacherId, academicYearId);
        for (TeacherSubjectAssignment a : mine) {
            if (a.getStatus() == TeacherSubjectAssignment.Status.ARCHIVED) continue;
            if (!classId.equals(a.getClassId())) continue;
            if (subjectId != null && !subjectId.equals(a.getSubjectId())) continue;
            if (sectionId != null && a.getSectionId() != null && !sectionId.equals(a.getSectionId())) continue;
            return true;
        }
        return false;
    }

    // ── Migration from the legacy Teacher.classSubjectAssignments field ──

    /**
     * Idempotent: on first read for a (teacher, year) pair, if the new collection
     * is empty for that teacher but the legacy field has entries, copy them over
     * tagged with the current or supplied academic year.
     */
    public void lazyMigrateFromLegacyIfNeeded(String teacherId, String academicYearId) {
        if (teacherId == null) return;
        String yearId = academicYearId;
        if (yearId == null) {
            yearId = academicYearRepo.findByIsCurrent(true)
                    .map(AcademicYear::getAcademicYearId)
                    .orElse(null);
        }
        if (yearId == null) return;

        List<TeacherSubjectAssignment> existing = repo.findByTeacherIdAndAcademicYearId(teacherId, yearId);
        if (!existing.isEmpty()) return;

        Teacher t = teacherRepo.findByTeacherIdAndDeletedAtIsNull(teacherId).orElse(null);
        if (t == null || t.getClassSubjectAssignments() == null || t.getClassSubjectAssignments().isEmpty()) return;

        for (Teacher.ClassSubjectAssignment legacy : t.getClassSubjectAssignments()) {
            TeacherSubjectAssignment a = new TeacherSubjectAssignment();
            a.setAssignmentId(UUID.randomUUID().toString());
            a.setTeacherId(teacherId);
            a.setAcademicYearId(yearId);
            a.setClassId(legacy.getClassId());
            a.setSectionId(legacy.getSectionId());
            a.setSubjectId(legacy.getSubjectId());
            a.setRoles(new HashSet<>(Set.of(Role.SUBJECT_TEACHER)));
            a.setStatus(TeacherSubjectAssignment.Status.ACTIVE);
            try {
                repo.save(a);
            } catch (Exception ignored) {
                // Ignore unique-constraint race if another request migrated the same pair.
            }
        }
        logger.info("Migrated {} legacy assignments for teacherId={} into year={}",
                t.getClassSubjectAssignments().size(), teacherId, yearId);
    }

    // ── Year rollover ────────────────────────────────────────────────

    public CarryForwardResult carryForward(CarryForwardAssignmentsRequest req) {
        // ── 1. Validate input ─────────────────────────────────────────
        if (req.getFromAcademicYearId() == null || req.getFromAcademicYearId().isBlank()
                || req.getToAcademicYearId() == null || req.getToAcademicYearId().isBlank()) {
            throw new IllegalArgumentException("Both source and target academic years are required.");
        }
        if (req.getFromAcademicYearId().equals(req.getToAcademicYearId())) {
            throw new IllegalArgumentException("Source and target academic years must be different.");
        }
        AcademicYear fromYear = academicYearRepo.findById(req.getFromAcademicYearId())
                .orElseThrow(() -> new IllegalArgumentException("Source academic year not found."));
        AcademicYear toYear = academicYearRepo.findById(req.getToAcademicYearId())
                .orElseThrow(() -> new IllegalArgumentException("Target academic year not found."));

        // ── 2. Target year MUST have classes — otherwise the copy is pointless ──
        List<SchoolClass> toClasses = schoolClassRepo.findAll().stream()
                .filter(c -> req.getToAcademicYearId().equals(c.getAcademicYearId()))
                .toList();
        if (toClasses.isEmpty()) {
            throw new IllegalArgumentException(
                    "No classes have been created for " + toYear.getLabel() + " yet. "
                  + "Open the Classes page and create classes for the target year first.");
        }

        // ── 3. Source year must have assignments to copy ──────────────
        List<TeacherSubjectAssignment> source = repo.findByAcademicYearId(req.getFromAcademicYearId());
        if (source.isEmpty()) {
            throw new IllegalArgumentException(
                    "No assignments exist for " + fromYear.getLabel() + " to carry forward.");
        }

        // ── 4. Build name-based maps so IDs from the old year map to IDs in the new year ──
        Map<String, SchoolClass> fromClassById = new HashMap<>();
        for (SchoolClass c : schoolClassRepo.findAll()) {
            if (req.getFromAcademicYearId().equals(c.getAcademicYearId())) {
                fromClassById.put(c.getClassId(), c);
            }
        }
        Map<String, SchoolClass> toClassByName = new HashMap<>();
        for (SchoolClass c : toClasses) {
            if (c.getName() != null) toClassByName.put(normalize(c.getName()), c);
        }

        Set<String> teacherFilter = req.getTeacherIds() == null ? null : new HashSet<>(req.getTeacherIds());

        CarryForwardResult result = new CarryForwardResult();
        result.fromYearLabel = fromYear.getLabel();
        result.toYearLabel = toYear.getLabel();
        List<String> warnings = new ArrayList<>();

        // ── 5. Walk each source assignment, remap ids, skip/report missing pieces ──
        for (TeacherSubjectAssignment src : source) {
            if (src.getStatus() == TeacherSubjectAssignment.Status.ARCHIVED) continue;
            if (teacherFilter != null && !teacherFilter.contains(src.getTeacherId())) continue;
            result.scanned++;

            SchoolClass oldCls = fromClassById.get(src.getClassId());
            if (oldCls == null || oldCls.getName() == null) {
                result.skippedMissingClass++;
                warnings.add("Source class missing for teacher " + src.getTeacherId() + "; skipped.");
                continue;
            }
            SchoolClass newCls = toClassByName.get(normalize(oldCls.getName()));
            if (newCls == null) {
                result.skippedNoMatchingClass++;
                warnings.add("No class named \"" + oldCls.getName() + "\" in " + toYear.getLabel()
                        + "; skipped " + src.getTeacherId() + ".");
                continue;
            }

            // Map section by name.
            String newSectionId = null;
            String oldSectionName = null;
            if (src.getSectionId() != null && oldCls.getSections() != null) {
                for (SchoolClass.Section s : oldCls.getSections()) {
                    if (src.getSectionId().equals(s.getSectionId())) {
                        oldSectionName = s.getName();
                        break;
                    }
                }
            }
            if (oldSectionName != null && newCls.getSections() != null) {
                for (SchoolClass.Section s : newCls.getSections()) {
                    if (oldSectionName.equalsIgnoreCase(s.getName())) {
                        newSectionId = s.getSectionId();
                        break;
                    }
                }
            }
            if (src.getSectionId() != null && newSectionId == null) {
                result.skippedNoMatchingSection++;
                warnings.add("No section \"" + oldSectionName + "\" in class \"" + newCls.getName()
                        + "\" for " + toYear.getLabel() + "; skipped.");
                continue;
            }

            // Subject must exist in the new class's sections (if section exists) or class-level subject list.
            String newSubjectId = src.getSubjectId();
            if (newSubjectId != null && newSectionId != null) {
                final String effectiveSectionId = newSectionId;
                SchoolClass.Section targetSec = newCls.getSections().stream()
                        .filter(s -> effectiveSectionId.equals(s.getSectionId()))
                        .findFirst().orElse(null);
                if (targetSec != null) {
                    List<String> subs = targetSec.getSubjectIds();
                    if (subs == null || !subs.contains(newSubjectId)) {
                        // Subject id from the old year's section doesn't exist on the new section.
                        result.skippedNoMatchingSubject++;
                        warnings.add("Subject not configured on new section for teacher "
                                + src.getTeacherId() + "; skipped.");
                        continue;
                    }
                }
            }

            // Dedupe.
            if (req.isSkipExisting()) {
                Optional<TeacherSubjectAssignment> dup = repo
                        .findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectId(
                                src.getTeacherId(), req.getToAcademicYearId(),
                                newCls.getClassId(), newSectionId, newSubjectId);
                if (dup.isPresent()) {
                    result.skippedDuplicate++;
                    continue;
                }
            }

            TeacherSubjectAssignment a = new TeacherSubjectAssignment();
            a.setAssignmentId(UUID.randomUUID().toString());
            a.setTeacherId(src.getTeacherId());
            a.setAcademicYearId(req.getToAcademicYearId());
            a.setClassId(newCls.getClassId());
            a.setSectionId(newSectionId);
            a.setSubjectId(newSubjectId);
            a.setRoles(new HashSet<>(src.getRoles() == null ? Set.of(Role.SUBJECT_TEACHER) : src.getRoles()));
            a.setStatus(TeacherSubjectAssignment.Status.ACTIVE);
            try {
                repo.save(a);
                result.copied++;
            } catch (Exception ex) {
                result.skippedDuplicate++;
                logger.warn("carryForward: save race skipped — {}", ex.getMessage());
            }
        }

        result.warnings = warnings;
        logger.info("carryForward: from={} to={} scanned={} copied={} skipped(class={}, section={}, subject={}, dup={}, missingClass={})",
                fromYear.getLabel(), toYear.getLabel(),
                result.scanned, result.copied,
                result.skippedNoMatchingClass, result.skippedNoMatchingSection,
                result.skippedNoMatchingSubject, result.skippedDuplicate, result.skippedMissingClass);
        return result;
    }

    private static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    /** Detailed result shape returned to the UI. */
    public static class CarryForwardResult {
        public String fromYearLabel;
        public String toYearLabel;
        public int scanned;
        public int copied;
        public int skippedDuplicate;
        public int skippedNoMatchingClass;
        public int skippedNoMatchingSection;
        public int skippedNoMatchingSubject;
        public int skippedMissingClass;
        public List<String> warnings = new ArrayList<>();

        public String getFromYearLabel() { return fromYearLabel; }
        public String getToYearLabel() { return toYearLabel; }
        public int getScanned() { return scanned; }
        public int getCopied() { return copied; }
        public int getSkippedDuplicate() { return skippedDuplicate; }
        public int getSkippedNoMatchingClass() { return skippedNoMatchingClass; }
        public int getSkippedNoMatchingSection() { return skippedNoMatchingSection; }
        public int getSkippedNoMatchingSubject() { return skippedNoMatchingSubject; }
        public int getSkippedMissingClass() { return skippedMissingClass; }
        public List<String> getWarnings() { return warnings; }
    }
}
