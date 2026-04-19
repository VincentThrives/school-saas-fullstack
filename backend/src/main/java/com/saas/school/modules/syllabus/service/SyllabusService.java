package com.saas.school.modules.syllabus.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.syllabus.dto.CreateSyllabusRequest;
import com.saas.school.modules.syllabus.dto.UpdateTopicRequest;
import com.saas.school.modules.syllabus.model.Syllabus;
import com.saas.school.modules.syllabus.repository.SyllabusRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.repository.TeacherSubjectAssignmentRepository;
import com.saas.school.modules.teacher.service.TeacherSubjectAssignmentService;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SyllabusService {

    private static final Logger logger = LoggerFactory.getLogger(SyllabusService.class);

    @Autowired private SyllabusRepository syllabusRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private TeacherSubjectAssignmentRepository assignmentRepository;
    @Autowired private TeacherSubjectAssignmentService assignmentService;
    @Autowired private UserRepository userRepository;
    @Autowired private AcademicYearRepository academicYearRepository;

    // ── CRUD ─────────────────────────────────────────────────────────────

    public Syllabus createSyllabus(CreateSyllabusRequest request, String currentUserId, String currentRole) {
        logger.info("Creating syllabus for classId={}, sectionId={}, subjectId={}, academicYearId={}",
                request.getClassId(), request.getSectionId(), request.getSubjectId(), request.getAcademicYearId());

        Teacher teacher = resolveTeacherForUser(currentUserId);
        // On create, trigger a lazy migration for this teacher+year so the check uses fresh data.
        if (teacher != null) {
            assignmentService.lazyMigrateFromLegacyIfNeeded(teacher.getTeacherId(), request.getAcademicYearId());
        }
        assertTeacherCanWrite(request.getClassId(), request.getSectionId(), request.getSubjectId(),
                request.getAcademicYearId(), teacher, currentRole);

        Syllabus syllabus = new Syllabus();
        syllabus.setClassId(request.getClassId());
        syllabus.setSectionId(request.getSectionId());
        syllabus.setSubjectId(request.getSubjectId());
        syllabus.setSubjectName(request.getSubjectName());
        syllabus.setAcademicYearId(request.getAcademicYearId());

        resolveNamesAndTeacher(syllabus, teacher, currentUserId);

        // Convert topic requests to topics (generate topicId for each)
        List<Syllabus.Topic> topics = new ArrayList<>();
        if (request.getTopics() != null) {
            for (CreateSyllabusRequest.TopicRequest tr : request.getTopics()) {
                Syllabus.Topic topic = new Syllabus.Topic();
                topic.setTopicId(UUID.randomUUID().toString());
                topic.setTopicName(tr.getTopicName());
                topic.setDescription(tr.getDescription());
                topic.setPlannedDate(tr.getPlannedDate());
                topic.setStatus(Syllabus.TopicStatus.PENDING);
                topic.setCompletionPercentage(0);
                topics.add(topic);
            }
        }
        syllabus.setTopics(topics);
        syllabus.setTotalTopics(topics.size());
        syllabus.setCompletedTopics(0);
        syllabus.setOverallProgress(0.0);

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Syllabus created with id={}", saved.getId());
        return saved;
    }

    public Syllabus getSyllabusById(String syllabusId) {
        Syllabus s = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));
        backfillIfNeeded(List.of(s));
        return s;
    }

    /**
     * Unified list endpoint. All filters optional.
     * When "mine" is true, only returns syllabi the current teacher can write to
     * (scoped to their classSubjectAssignments).
     */
    public List<Syllabus> list(String academicYearId,
                                String classId,
                                String sectionId,
                                String subjectId,
                                String teacherIdFilter,
                                boolean mine,
                                String currentUserId,
                                String currentRole) {
        List<Syllabus> all;
        if (classId != null && !classId.isBlank() && academicYearId != null && !academicYearId.isBlank()) {
            all = (sectionId != null && !sectionId.isBlank())
                ? syllabusRepository.findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId)
                : syllabusRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        } else if (academicYearId != null && !academicYearId.isBlank()) {
            all = syllabusRepository.findByAcademicYearId(academicYearId);
        } else {
            all = syllabusRepository.findAll();
        }

        backfillIfNeeded(all);

        // Narrow for teacher ("mine") — use their classSubjectAssignments tuples.
        boolean isTeacherScope = mine || "TEACHER".equalsIgnoreCase(currentRole);
        if (isTeacherScope) {
            Teacher me = resolveTeacherForUser(currentUserId);
            // Lazy-migrate legacy field → new collection for this teacher+year, if applicable.
            if (me != null && academicYearId != null) {
                assignmentService.lazyMigrateFromLegacyIfNeeded(me.getTeacherId(), academicYearId);
            }
            logger.info("Syllabus list for teacher userId={} teacherId={} totalBeforeFilter={}",
                    currentUserId,
                    me == null ? null : me.getTeacherId(),
                    all.size());
            if (me == null) return List.of();
            Set<String> allowedKeys = teacherKeys(me);
            final Teacher teacher = me;
            List<Syllabus> rejected = new ArrayList<>();
            all = all.stream()
                    .peek(s -> {
                        if (!matchesAnyAssignment(s, allowedKeys, teacher)) rejected.add(s);
                    })
                    .filter(s -> matchesAnyAssignment(s, allowedKeys, teacher))
                    .collect(Collectors.toList());
            for (Syllabus r : rejected) {
                logger.info("  rejected syllabus id={} class={} section={} subject={} teacherId={}",
                        r.getId(), r.getClassId(), r.getSectionId(), r.getSubjectId(), r.getTeacherId());
            }
            logger.info("Syllabus list after teacher filter: {}", all.size());
        }

        // Extra optional filters.
        if (subjectId != null && !subjectId.isBlank()) {
            all = all.stream().filter(s -> subjectId.equals(s.getSubjectId())).collect(Collectors.toList());
        }
        if (teacherIdFilter != null && !teacherIdFilter.isBlank()) {
            all = all.stream().filter(s -> teacherIdFilter.equals(s.getTeacherId())).collect(Collectors.toList());
        }
        if (sectionId != null && !sectionId.isBlank()) {
            all = all.stream().filter(s -> sectionId.equals(s.getSectionId())).collect(Collectors.toList());
        }
        if (classId != null && !classId.isBlank()) {
            all = all.stream().filter(s -> classId.equals(s.getClassId())).collect(Collectors.toList());
        }

        return all;
    }

    public Syllabus updateSyllabus(String syllabusId, CreateSyllabusRequest request,
                                   String currentUserId, String currentRole) {
        logger.info("Updating syllabus id={}", syllabusId);

        Syllabus syllabus = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));

        Teacher me = resolveTeacherForUser(currentUserId);
        assertTeacherCanWriteExisting(syllabus, me, currentRole);

        // Allow changing subject/class/section/year only by admin/principal.
        boolean isAdmin = "SCHOOL_ADMIN".equalsIgnoreCase(currentRole) || "PRINCIPAL".equalsIgnoreCase(currentRole);
        if (isAdmin) {
            if (request.getClassId() != null) syllabus.setClassId(request.getClassId());
            if (request.getSectionId() != null) syllabus.setSectionId(request.getSectionId());
            if (request.getSubjectId() != null) syllabus.setSubjectId(request.getSubjectId());
            if (request.getAcademicYearId() != null) syllabus.setAcademicYearId(request.getAcademicYearId());
        }
        if (request.getSubjectName() != null) syllabus.setSubjectName(request.getSubjectName());

        resolveNamesAndTeacher(syllabus, me, currentUserId);

        if (request.getTopics() != null) {
            // Preserve progress for topics whose topicId matches; new topics get fresh UUIDs.
            Map<String, Syllabus.Topic> prev = new HashMap<>();
            if (syllabus.getTopics() != null) {
                for (Syllabus.Topic t : syllabus.getTopics()) {
                    if (t.getTopicId() != null) prev.put(t.getTopicId(), t);
                }
            }
            List<Syllabus.Topic> updated = new ArrayList<>();
            for (CreateSyllabusRequest.TopicRequest tr : request.getTopics()) {
                Syllabus.Topic existing = tr.getTopicId() != null ? prev.get(tr.getTopicId()) : null;
                Syllabus.Topic t = new Syllabus.Topic();
                t.setTopicId(existing != null ? existing.getTopicId() : UUID.randomUUID().toString());
                t.setTopicName(tr.getTopicName());
                t.setDescription(tr.getDescription());
                t.setPlannedDate(tr.getPlannedDate());
                t.setStatus(existing != null ? existing.getStatus() : Syllabus.TopicStatus.PENDING);
                t.setCompletionPercentage(existing != null ? existing.getCompletionPercentage() : 0);
                t.setCompletedDate(existing != null ? existing.getCompletedDate() : null);
                updated.add(t);
            }
            syllabus.setTopics(updated);
            syllabus.setTotalTopics(updated.size());
            recalculateProgress(syllabus);
        }

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Syllabus updated id={}", saved.getId());
        return saved;
    }

    public Syllabus updateTopicStatus(String syllabusId, UpdateTopicRequest request,
                                      String currentUserId, String currentRole) {
        logger.info("Updating topic status for syllabusId={}, topicId={}", syllabusId, request.getTopicId());

        Syllabus syllabus = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));

        Teacher me = resolveTeacherForUser(currentUserId);
        assertTeacherCanWriteExisting(syllabus, me, currentRole);

        List<Syllabus.Topic> topics = syllabus.getTopics();
        if (topics == null || topics.isEmpty()) {
            throw new IllegalArgumentException("Syllabus has no topics");
        }
        // Lazy-assign topicIds for legacy syllabi (first-time PATCH on old docs).
        boolean changedIds = false;
        for (Syllabus.Topic t : topics) {
            if (t.getTopicId() == null || t.getTopicId().isBlank()) {
                t.setTopicId(UUID.randomUUID().toString());
                changedIds = true;
            }
        }

        Syllabus.Topic topic = topics.stream()
                .filter(t -> request.getTopicId() != null && request.getTopicId().equals(t.getTopicId()))
                .findFirst()
                .orElse(null);
        if (topic == null) {
            if (changedIds) syllabusRepository.save(syllabus);
            throw new IllegalArgumentException("Topic not found: " + request.getTopicId());
        }

        if (request.getStatus() != null) {
            topic.setStatus(Syllabus.TopicStatus.valueOf(request.getStatus().toUpperCase()));
        }
        topic.setCompletionPercentage(Math.max(0, Math.min(100, request.getCompletionPercentage())));
        if (request.getCompletedDate() != null) {
            topic.setCompletedDate(request.getCompletedDate());
        }

        // If completion percentage is 100, auto-set status to COMPLETED.
        if (topic.getCompletionPercentage() >= 100) {
            topic.setStatus(Syllabus.TopicStatus.COMPLETED);
        } else if (topic.getCompletionPercentage() == 0 && topic.getStatus() != Syllabus.TopicStatus.IN_PROGRESS) {
            topic.setStatus(Syllabus.TopicStatus.PENDING);
            topic.setCompletedDate(null);
        }

        recalculateProgress(syllabus);

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Topic status updated for syllabusId={}, topicId={}", syllabusId, request.getTopicId());
        return saved;
    }

    public void deleteSyllabus(String syllabusId, String currentUserId, String currentRole) {
        logger.info("Deleting syllabus id={}", syllabusId);
        Syllabus syllabus = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));
        Teacher me = resolveTeacherForUser(currentUserId);
        assertTeacherCanWriteExisting(syllabus, me, currentRole);
        syllabusRepository.deleteById(syllabusId);
        logger.info("Syllabus deleted id={}", syllabusId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Teacher resolveTeacherForUser(String userId) {
        if (userId == null) return null;
        return teacherRepository.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
    }

    /**
     * A syllabus matches a teacher assignment when:
     *   - classId is equal, AND
     *   - subjectId is equal, AND
     *   - sections are compatible (either side null = wildcard, or both sides equal).
     * Owner-by-id (teacher.teacherId == syllabus.teacherId) is also accepted.
     */
    /** Matches a syllabus to a teacher via the canonical TeacherSubjectAssignment collection. */
    private boolean matchesAnyAssignment(Syllabus s, Set<String> unusedAllowedKeys, Teacher teacher) {
        if (teacher == null) return false;
        // Direct ownership — teacherId OR userId stored in the syllabus.
        if (teacher.getTeacherId() != null && teacher.getTeacherId().equals(s.getTeacherId())) return true;
        if (teacher.getUserId() != null && teacher.getUserId().equals(s.getTeacherId())) return true;

        // Check the new assignment collection.
        return assignmentService.canTeach(
                teacher.getTeacherId(), s.getAcademicYearId(),
                s.getClassId(), s.getSectionId(), s.getSubjectId());
    }

    /** Returns the teacher's classIds for the given year — used to narrow list queries. */
    private Set<String> teacherKeys(Teacher teacher) {
        // Kept as a no-op for backwards compatibility; the new matcher doesn't use it.
        return new HashSet<>();
    }

    private boolean teacherHasAssignmentFor(Teacher teacher, String academicYearId,
                                            String classId, String sectionId, String subjectId) {
        if (teacher == null) return false;
        return assignmentService.canTeach(teacher.getTeacherId(), academicYearId, classId, sectionId, subjectId);
    }

    private void assertTeacherCanWrite(String classId, String sectionId, String subjectId,
                                       String academicYearId,
                                       Teacher teacher, String currentRole) {
        if ("SCHOOL_ADMIN".equalsIgnoreCase(currentRole) || "PRINCIPAL".equalsIgnoreCase(currentRole)) return;
        if (teacher == null) throw new SecurityException("Teacher profile not found");
        if (!teacherHasAssignmentFor(teacher, academicYearId, classId, sectionId, subjectId)) {
            throw new SecurityException("Teacher is not assigned to this class/section/subject for this year");
        }
    }

    private void assertTeacherCanWriteExisting(Syllabus syllabus, Teacher teacher, String currentRole) {
        if ("SCHOOL_ADMIN".equalsIgnoreCase(currentRole) || "PRINCIPAL".equalsIgnoreCase(currentRole)) return;
        if (teacher != null && teacher.getTeacherId() != null
                && teacher.getTeacherId().equals(syllabus.getTeacherId())) return;
        if (!teacherHasAssignmentFor(teacher, syllabus.getAcademicYearId(),
                syllabus.getClassId(), syllabus.getSectionId(), syllabus.getSubjectId())) {
            throw new SecurityException("Teacher is not allowed to modify this syllabus");
        }
    }

    /** Populate className, sectionName, subjectName, academicYearLabel, teacher info. */
    private void resolveNamesAndTeacher(Syllabus syllabus, Teacher callerTeacher, String currentUserId) {
        if (syllabus.getClassId() != null) {
            SchoolClass cls = schoolClassRepository.findById(syllabus.getClassId()).orElse(null);
            if (cls != null) {
                syllabus.setClassName(cls.getName());
                if (syllabus.getSectionId() != null && cls.getSections() != null) {
                    cls.getSections().stream()
                            .filter(sec -> syllabus.getSectionId().equals(sec.getSectionId()))
                            .findFirst()
                            .ifPresent(sec -> syllabus.setSectionName(sec.getName()));
                }
            }
        }
        if (syllabus.getSubjectId() != null
                && (syllabus.getSubjectName() == null || syllabus.getSubjectName().isBlank())) {
            subjectRepository.findById(syllabus.getSubjectId())
                    .ifPresent(subj -> syllabus.setSubjectName(subj.getName()));
        }
        if (syllabus.getAcademicYearId() != null) {
            academicYearRepository.findById(syllabus.getAcademicYearId())
                    .ifPresent(ay -> syllabus.setAcademicYearLabel(ay.getLabel()));
        }

        // Teacher resolution: teacher caller → themselves. Admin → pull from Subject.teacherAssignments,
        // and if that's empty, scan all teachers for a matching classSubjectAssignment.
        if (callerTeacher != null) {
            syllabus.setTeacherId(callerTeacher.getTeacherId());
            User user = userRepository.findById(callerTeacher.getUserId()).orElse(null);
            if (user != null) syllabus.setTeacherName(user.getFirstName() + " " + user.getLastName());
        } else if (syllabus.getSubjectId() != null && (syllabus.getTeacherId() == null || syllabus.getTeacherId().isBlank())) {
            subjectRepository.findById(syllabus.getSubjectId()).ifPresent(subj -> {
                if (subj.getTeacherAssignments() != null && !subj.getTeacherAssignments().isEmpty()) {
                    String matchTeacherId = null;
                    for (Subject.TeacherAssignment ta : subj.getTeacherAssignments()) {
                        if (syllabus.getSectionId() == null || syllabus.getSectionId().isBlank()
                                || syllabus.getSectionId().equals(ta.getSectionId())) {
                            matchTeacherId = ta.getTeacherId();
                            break;
                        }
                    }
                    if (matchTeacherId != null) {
                        syllabus.setTeacherId(matchTeacherId);
                        teacherRepository.findByTeacherIdAndDeletedAtIsNull(matchTeacherId).ifPresent(t -> {
                            userRepository.findById(t.getUserId()).ifPresent(u ->
                                syllabus.setTeacherName(u.getFirstName() + " " + u.getLastName()));
                        });
                    }
                }
            });
            // Fallback #2: scan every teacher for a matching assignment.
            if (syllabus.getTeacherId() == null || syllabus.getTeacherId().isBlank()) {
                try {
                    for (Teacher t : teacherRepository.findAll()) {
                        if (t.getDeletedAt() != null) continue;
                        if (t.getClassSubjectAssignments() == null) continue;
                        for (Teacher.ClassSubjectAssignment a : t.getClassSubjectAssignments()) {
                            if (!syllabus.getClassId().equals(a.getClassId())) continue;
                            if (!syllabus.getSubjectId().equals(a.getSubjectId())) continue;
                            String sSec = syllabus.getSectionId();
                            String aSec = a.getSectionId();
                            if (sSec == null || aSec == null || sSec.equals(aSec)) {
                                syllabus.setTeacherId(t.getTeacherId());
                                userRepository.findById(t.getUserId()).ifPresent(u ->
                                    syllabus.setTeacherName(u.getFirstName() + " " + u.getLastName()));
                                break;
                            }
                        }
                        if (syllabus.getTeacherId() != null && !syllabus.getTeacherId().isBlank()) break;
                    }
                } catch (Exception ex) {
                    logger.warn("Teacher fallback scan failed: {}", ex.getMessage());
                }
            }
        }
    }

    /** Fill in sectionName / academicYearLabel / topicId / teacherId for legacy docs on read. */
    private void backfillIfNeeded(List<Syllabus> syllabi) {
        int fixed = 0;
        for (Syllabus s : syllabi) {
            boolean changed = false;

            // Topic IDs
            if (s.getTopics() != null) {
                for (Syllabus.Topic t : s.getTopics()) {
                    if (t.getTopicId() == null || t.getTopicId().isBlank()) {
                        t.setTopicId(UUID.randomUUID().toString());
                        changed = true;
                    }
                }
            }

            // Labels (nullable fields that weren't written before)
            if ((s.getAcademicYearLabel() == null || s.getAcademicYearLabel().isBlank())
                    && s.getAcademicYearId() != null) {
                AcademicYear ay = academicYearRepository.findById(s.getAcademicYearId()).orElse(null);
                if (ay != null) { s.setAcademicYearLabel(ay.getLabel()); changed = true; }
            }
            if ((s.getSectionName() == null || s.getSectionName().isBlank())
                    && s.getSectionId() != null && s.getClassId() != null) {
                SchoolClass cls = schoolClassRepository.findById(s.getClassId()).orElse(null);
                if (cls != null && cls.getSections() != null) {
                    cls.getSections().stream()
                            .filter(sec -> s.getSectionId().equals(sec.getSectionId()))
                            .findFirst()
                            .ifPresent(sec -> s.setSectionName(sec.getName()));
                    if (s.getSectionName() != null) changed = true;
                }
            }

            // Teacher binding — look up matching teacher if missing (so teacher-scope lists pick it up).
            if ((s.getTeacherId() == null || s.getTeacherId().isBlank())
                    && s.getClassId() != null && s.getSubjectId() != null && s.getAcademicYearId() != null) {
                try {
                    // First try the canonical assignment collection.
                    List<TeacherSubjectAssignment> matches = assignmentRepository
                            .findByClassIdAndAcademicYearId(s.getClassId(), s.getAcademicYearId());
                    TeacherSubjectAssignment hit = null;
                    for (TeacherSubjectAssignment a : matches) {
                        if (a.getStatus() == TeacherSubjectAssignment.Status.ARCHIVED) continue;
                        if (!s.getSubjectId().equals(a.getSubjectId())) continue;
                        String sSec = s.getSectionId();
                        String aSec = a.getSectionId();
                        if (sSec == null || aSec == null || sSec.equals(aSec)) { hit = a; break; }
                    }
                    if (hit != null) {
                        s.setTeacherId(hit.getTeacherId());
                        teacherRepository.findByTeacherIdAndDeletedAtIsNull(hit.getTeacherId()).ifPresent(t ->
                            userRepository.findById(t.getUserId()).ifPresent(u ->
                                s.setTeacherName(u.getFirstName() + " " + u.getLastName())));
                        changed = true;
                    } else {
                        // Fallback to the legacy field (covers pre-migration data).
                        for (Teacher t : teacherRepository.findAll()) {
                            if (t.getDeletedAt() != null) continue;
                            if (t.getClassSubjectAssignments() == null) continue;
                            boolean match = false;
                            for (Teacher.ClassSubjectAssignment a : t.getClassSubjectAssignments()) {
                                if (!s.getClassId().equals(a.getClassId())) continue;
                                if (!s.getSubjectId().equals(a.getSubjectId())) continue;
                                String sSec = s.getSectionId();
                                String aSec = a.getSectionId();
                                if (sSec == null || aSec == null || sSec.equals(aSec)) { match = true; break; }
                            }
                            if (match) {
                                s.setTeacherId(t.getTeacherId());
                                userRepository.findById(t.getUserId()).ifPresent(u ->
                                    s.setTeacherName(u.getFirstName() + " " + u.getLastName()));
                                changed = true;
                                break;
                            }
                        }
                    }
                } catch (Exception ex) {
                    logger.warn("Teacher backfill scan failed: {}", ex.getMessage());
                }
            }

            if (changed) { syllabusRepository.save(s); fixed++; }
        }
        if (fixed > 0) logger.info("Backfilled topicId/labels/teacher for {} syllabi", fixed);
    }

    private void recalculateProgress(Syllabus syllabus) {
        List<Syllabus.Topic> topics = syllabus.getTopics();
        if (topics == null || topics.isEmpty()) {
            syllabus.setCompletedTopics(0);
            syllabus.setOverallProgress(0.0);
            return;
        }

        int completed = 0;
        double totalProgress = 0;

        for (Syllabus.Topic topic : topics) {
            if (topic.getStatus() == Syllabus.TopicStatus.COMPLETED) {
                completed++;
            }
            totalProgress += topic.getCompletionPercentage();
        }

        syllabus.setCompletedTopics(completed);
        syllabus.setTotalTopics(topics.size());
        double overall = totalProgress / topics.size();
        syllabus.setOverallProgress(Math.round(overall * 100.0) / 100.0);
    }
}
