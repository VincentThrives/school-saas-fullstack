package com.saas.school.modules.exam.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.dto.EnterInternalMarksRequest;
import com.saas.school.modules.exam.model.ComponentInternalMark;
import com.saas.school.modules.exam.repository.ComponentInternalMarkRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Writes / reads marks for INTERNAL-mode subject components. Mirrors
 * the bulk-entry shape of regular exam marks (one request enters or
 * updates all students for one component / period in a single call).
 */
@Service
public class ComponentInternalMarkService {

    @Autowired private ComponentInternalMarkRepository repository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private AuditService auditService;

    /**
     * Upsert internal marks for a class on a (subject, component,
     * year, term) key. Existing rows are updated; missing rows are
     * created. Validates the target component is actually configured
     * as INTERNAL on the subject — to prevent accidental writes to
     * EXAM-mode components which would never surface on the report.
     */
    public List<ComponentInternalMark> saveBulk(EnterInternalMarksRequest req, String enteredByUserId) {
        if (req.getSubjectId() == null || req.getSubjectId().isBlank()) {
            throw new IllegalArgumentException("subjectId is required");
        }
        if (req.getComponentKey() == null || req.getComponentKey().isBlank()) {
            throw new IllegalArgumentException("componentKey is required");
        }
        if (req.getAcademicYearId() == null || req.getAcademicYearId().isBlank()) {
            throw new IllegalArgumentException("academicYearId is required");
        }
        if (req.getEntries() == null || req.getEntries().isEmpty()) {
            throw new IllegalArgumentException("entries cannot be empty");
        }

        Subject subject = subjectRepository.findById(req.getSubjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));

        Subject.Component target = subject.componentByKey(req.getComponentKey());
        if (target == null) {
            throw new IllegalArgumentException(
                    "Component '" + req.getComponentKey() + "' not found on subject '"
                            + subject.getName() + "'");
        }
        if (target.getAssessmentMode() != Subject.AssessmentMode.INTERNAL) {
            throw new IllegalArgumentException(
                    "Component '" + target.getLabel() + "' is not INTERNAL; use the exam marks API instead.");
        }

        // termId required for PER_TERM; null required for PER_YEAR.
        Subject.InternalSchedule schedule = target.getInternalSchedule() == null
                ? Subject.InternalSchedule.PER_TERM
                : target.getInternalSchedule();
        if (schedule == Subject.InternalSchedule.PER_TERM
                && (req.getTermId() == null || req.getTermId().isBlank())) {
            throw new IllegalArgumentException(
                    "Component '" + target.getLabel() + "' is scheduled PER_TERM; termId is required.");
        }
        if (schedule == Subject.InternalSchedule.PER_YEAR && req.getTermId() != null && !req.getTermId().isBlank()) {
            // Silently normalise — caller may have sent a value out of habit; we drop it
            // so the unique index treats this as one row per (student, subject, component, year).
            req.setTermId(null);
        }

        Integer max = target.getMaxMarks();
        List<ComponentInternalMark> saved = new ArrayList<>();
        for (EnterInternalMarksRequest.Entry e : req.getEntries()) {
            if (e.getStudentId() == null || e.getStudentId().isBlank()) continue;
            if (e.getMarksObtained() != null && max != null && e.getMarksObtained() > max) {
                throw new IllegalArgumentException(
                        "Marks " + e.getMarksObtained() + " exceed component max " + max
                                + " for student " + e.getStudentId());
            }
            ComponentInternalMark existing = repository
                    .findByStudentIdAndSubjectIdAndComponentKeyAndAcademicYearIdAndTermId(
                            e.getStudentId(), req.getSubjectId(), req.getComponentKey(),
                            req.getAcademicYearId(), req.getTermId())
                    .orElseGet(() -> {
                        ComponentInternalMark m = new ComponentInternalMark();
                        m.setMarkId(UUID.randomUUID().toString());
                        m.setStudentId(e.getStudentId());
                        m.setSubjectId(req.getSubjectId());
                        m.setComponentKey(req.getComponentKey());
                        m.setAcademicYearId(req.getAcademicYearId());
                        m.setTermId(req.getTermId());
                        return m;
                    });
            existing.setMarksObtained(e.getMarksObtained());
            existing.setRemarks(e.getRemarks());
            existing.setEnteredBy(enteredByUserId);
            saved.add(repository.save(existing));
        }
        auditService.log("INTERNAL_MARKS_SAVED", "ComponentInternalMark", req.getSubjectId(),
                "Bulk internal marks saved: subject=" + subject.getName()
                        + ", component=" + target.getLabel() + ", count=" + saved.size());
        return saved;
    }

    /** Read all internal marks for a student in a year — used by ReportCardService. */
    public List<ComponentInternalMark> findForStudent(String studentId, String academicYearId) {
        return repository.findByStudentIdAndAcademicYearId(studentId, academicYearId);
    }

    /** Read marks for a single (subject, component, year, term) — used by the marks-entry UI to pre-fill. */
    public List<ComponentInternalMark> findForComponent(
            String subjectId, String componentKey, String academicYearId, String termId) {
        return repository.findAll().stream()
                .filter(m -> subjectId.equals(m.getSubjectId()))
                .filter(m -> componentKey.equals(m.getComponentKey()))
                .filter(m -> academicYearId.equals(m.getAcademicYearId()))
                .filter(m -> termId == null ? m.getTermId() == null : termId.equals(m.getTermId()))
                .toList();
    }
}
