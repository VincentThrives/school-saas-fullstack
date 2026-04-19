package com.saas.school.modules.teacher.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
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

    public int carryForward(CarryForwardAssignmentsRequest req) {
        if (req.getFromAcademicYearId() == null || req.getToAcademicYearId() == null) {
            throw new IllegalArgumentException("fromAcademicYearId and toAcademicYearId are required");
        }
        if (req.getFromAcademicYearId().equals(req.getToAcademicYearId())) {
            throw new IllegalArgumentException("Source and target academic years must be different");
        }

        List<TeacherSubjectAssignment> source = repo.findByAcademicYearId(req.getFromAcademicYearId());
        Set<String> teacherFilter = req.getTeacherIds() == null ? null : new HashSet<>(req.getTeacherIds());

        int copied = 0;
        for (TeacherSubjectAssignment src : source) {
            if (src.getStatus() == TeacherSubjectAssignment.Status.ARCHIVED) continue;
            if (teacherFilter != null && !teacherFilter.contains(src.getTeacherId())) continue;

            if (req.isSkipExisting()) {
                Optional<TeacherSubjectAssignment> dup = repo
                        .findByTeacherIdAndAcademicYearIdAndClassIdAndSectionIdAndSubjectId(
                                src.getTeacherId(), req.getToAcademicYearId(),
                                src.getClassId(), src.getSectionId(), src.getSubjectId());
                if (dup.isPresent()) continue;
            }

            TeacherSubjectAssignment a = new TeacherSubjectAssignment();
            a.setAssignmentId(UUID.randomUUID().toString());
            a.setTeacherId(src.getTeacherId());
            a.setAcademicYearId(req.getToAcademicYearId());
            a.setClassId(src.getClassId());
            a.setSectionId(src.getSectionId());
            a.setSubjectId(src.getSubjectId());
            a.setRoles(new HashSet<>(src.getRoles() == null ? Set.of(Role.SUBJECT_TEACHER) : src.getRoles()));
            a.setStatus(TeacherSubjectAssignment.Status.ACTIVE);
            try {
                repo.save(a);
                copied++;
            } catch (Exception ex) {
                logger.warn("carryForward: skipped duplicate for teacher={} class={} subject={} — {}",
                        src.getTeacherId(), src.getClassId(), src.getSubjectId(), ex.getMessage());
            }
        }
        logger.info("carryForward: copied {} assignments from {} → {}", copied,
                req.getFromAcademicYearId(), req.getToAcademicYearId());
        return copied;
    }
}
