package com.saas.school.modules.timetable.service;

import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.timetable.model.Timetable;
import com.saas.school.modules.timetable.repository.TimetableRepository;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TimetableService {

    private static final Logger logger = LoggerFactory.getLogger(TimetableService.class);

    @Autowired
    private TimetableRepository timetableRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    public Timetable getOrCreate(String classId, String sectionId, String academicYearId) {
        logger.info("getOrCreate timetable for classId={}, sectionId={}, academicYearId={}", classId, sectionId, academicYearId);
        Timetable existing = timetableRepository
                .findByClassIdAndSectionIdAndAcademicYearId(classId, sectionId, academicYearId)
                .orElse(null);
        if (existing != null) {
            logger.info("Found existing timetable id={}", existing.getTimetableId());
            return existing;
        }
        logger.info("No existing timetable found, creating empty one");
        Timetable timetable = new Timetable();
        timetable.setTimetableId(UUID.randomUUID().toString());
        timetable.setClassId(classId);
        timetable.setSectionId(sectionId);
        timetable.setAcademicYearId(academicYearId);
        timetable.setSchedule(new ArrayList<>());
        Timetable saved = timetableRepository.save(timetable);
        logger.info("Created timetable id={}", saved.getTimetableId());
        return saved;
    }

    public Timetable save(Timetable timetable) {
        if (timetable.getTimetableId() == null || timetable.getTimetableId().isEmpty()) {
            // Check for duplicate: same class + section + academic year
            var existing = timetableRepository.findByClassIdAndSectionIdAndAcademicYearId(
                    timetable.getClassId(), timetable.getSectionId(), timetable.getAcademicYearId());
            if (existing.isPresent()) {
                // Update existing instead of creating duplicate
                timetable.setTimetableId(existing.get().getTimetableId());
                logger.info("Found existing timetable, updating id={}", timetable.getTimetableId());
            } else {
                timetable.setTimetableId(UUID.randomUUID().toString());
                logger.info("Saving new timetable with generated id={}", timetable.getTimetableId());
            }
        } else {
            logger.info("Saving timetable id={}", timetable.getTimetableId());
        }

        // Enforce: a teacher cannot be in two classes at the same period+day
        // within the same academic year. Throws IllegalArgumentException → 400.
        assertNoTeacherDoubleBooking(timetable);
        // Enforce: when a slot has multiple parallel periods (same
        // dayOfWeek + periodNumber inside this section's schedule),
        // every subject in that slot must be marked elective and no
        // two parallel periods may share a teacher.
        assertParallelPeriodsAreElective(timetable);

        return timetableRepository.save(timetable);
    }

    /**
     * Refuse the save when any teacher in the incoming schedule is already
     * teaching another class+section at the same {@code dayOfWeek} +
     * {@code periodNumber} for the same academic year.
     *
     * Self (same timetableId or same class+section+year) is excluded so that
     * editing your own timetable doesn't conflict with itself.
     */
    private void assertNoTeacherDoubleBooking(Timetable incoming) {
        if (incoming.getSchedule() == null || incoming.getAcademicYearId() == null) return;

        // All other timetables for the same academic year.
        List<Timetable> others = timetableRepository.findByAcademicYearId(incoming.getAcademicYearId());
        for (Timetable.DaySchedule day : incoming.getSchedule()) {
            if (day == null || day.getPeriods() == null || day.getDayOfWeek() == null) continue;
            for (Timetable.Period p : day.getPeriods()) {
                if (p == null || p.getTeacherId() == null || p.getTeacherId().isBlank()) continue;
                String teacherId = p.getTeacherId();
                int periodNumber = p.getPeriodNumber();

                for (Timetable other : others) {
                    if (other.getTimetableId() != null
                            && other.getTimetableId().equals(incoming.getTimetableId())) continue;
                    // Same class + section is also "self" (covers a save where the id wasn't supplied yet).
                    if (java.util.Objects.equals(other.getClassId(), incoming.getClassId())
                            && java.util.Objects.equals(other.getSectionId(), incoming.getSectionId())) continue;
                    if (other.getSchedule() == null) continue;

                    for (Timetable.DaySchedule oDay : other.getSchedule()) {
                        if (oDay == null || oDay.getPeriods() == null) continue;
                        if (!day.getDayOfWeek().equalsIgnoreCase(oDay.getDayOfWeek())) continue;

                        for (Timetable.Period op : oDay.getPeriods()) {
                            if (op == null || op.getTeacherId() == null) continue;
                            if (!teacherId.equals(op.getTeacherId())) continue;
                            if (op.getPeriodNumber() != periodNumber) continue;

                            // Combined-period escape hatch — PE, Assembly, Drill, Library
                            // and similar "group" subjects let one teacher legitimately
                            // run multiple sections at the same time slot. Only relax
                            // the conflict when BOTH the incoming period and the
                            // existing period are for subjects that opted in via
                            // {@link Subject#isGroupPeriodAllowed()}. Math vs PE for
                            // the same teacher in the same slot still raises.
                            if (subjectAllowsGroupPeriod(p.getSubjectId())
                                    && subjectAllowsGroupPeriod(op.getSubjectId())) {
                                continue;
                            }

                            // Double booking found. Build a clear error message.
                            String teacherLabel = op.getTeacherName() != null && !op.getTeacherName().isBlank()
                                    ? op.getTeacherName() : "This teacher";
                            String otherSlot = describeOther(other);
                            throw new IllegalArgumentException(
                                    teacherLabel + " is already assigned to " + otherSlot
                                  + " for period " + periodNumber + " on " + day.getDayOfWeek()
                                  + ". A teacher can't take two classes at the same period on the same day.");
                        }
                    }
                }
            }
        }
    }

    /**
     * Reject a schedule where the same {@code dayOfWeek + periodNumber}
     * has two or more periods inside one section's day, unless every
     * subject in that slot is marked elective. The intent: a section
     * legitimately runs two parallel periods only when students split
     * across elective subjects (PU 2nd-language Sanskrit + Kannada
     * during the same Monday 1st period). Two non-electives in the
     * same slot is almost always an admin typo — flag it loud.
     *
     * <p>Also rejects when two parallel periods name the same teacher,
     * since a teacher can't physically be in both rooms.</p>
     */
    private void assertParallelPeriodsAreElective(Timetable incoming) {
        if (incoming.getSchedule() == null) return;
        for (Timetable.DaySchedule day : incoming.getSchedule()) {
            if (day == null || day.getPeriods() == null || day.getDayOfWeek() == null) continue;
            // Group this day's periods by periodNumber.
            java.util.Map<Integer, java.util.List<Timetable.Period>> byPeriod = new java.util.LinkedHashMap<>();
            for (Timetable.Period p : day.getPeriods()) {
                if (p == null) continue;
                byPeriod.computeIfAbsent(p.getPeriodNumber(), k -> new java.util.ArrayList<>()).add(p);
            }
            for (var entry : byPeriod.entrySet()) {
                java.util.List<Timetable.Period> parallel = entry.getValue();
                if (parallel.size() < 2) continue;
                int periodNumber = entry.getKey();

                // Every subject in the slot must be elective.
                for (Timetable.Period p : parallel) {
                    if (!subjectIsElective(p.getSubjectId())) {
                        throw new IllegalArgumentException(
                                "Period " + periodNumber + " on " + day.getDayOfWeek()
                              + " has more than one subject in the same slot, but '"
                              + (p.getSubjectName() != null ? p.getSubjectName() : p.getSubjectId())
                              + "' is not marked as an elective. Two parallel periods are only "
                              + "allowed when every subject in the slot is an elective.");
                    }
                }

                // No two parallel periods can share a teacher (they'd be in two rooms at once).
                java.util.Set<String> teacherIds = new java.util.HashSet<>();
                for (Timetable.Period p : parallel) {
                    if (p.getTeacherId() == null || p.getTeacherId().isBlank()) continue;
                    if (!teacherIds.add(p.getTeacherId())) {
                        throw new IllegalArgumentException(
                                "Period " + periodNumber + " on " + day.getDayOfWeek()
                              + " has the same teacher assigned to two parallel elective periods. "
                              + "Pick a different teacher for one of them.");
                    }
                }
            }
        }
    }

    /** Look up the subject by id and return whether it's marked
     *  elective. Null / unknown ids resolve to false so a half-filled
     *  parallel slot can't pass validation. */
    private boolean subjectIsElective(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return false;
        Subject s = subjectRepository.findById(subjectId).orElse(null);
        return s != null && s.isElective();
    }

    /**
     * Look up the subject by id and return whether it opted in to the
     * combined-period rule. Null / unknown ids resolve to false so the
     * conflict guard stays strict by default — a period with a missing
     * subjectId can't slip through the relaxation.
     */
    private boolean subjectAllowsGroupPeriod(String subjectId) {
        if (subjectId == null || subjectId.isBlank()) return false;
        Subject s = subjectRepository.findById(subjectId).orElse(null);
        return s != null && s.isGroupPeriodAllowed();
    }

    private String describeOther(Timetable other) {
        String cls = other.getClassName() != null && !other.getClassName().isBlank()
                ? other.getClassName() : "another class";
        String sec = other.getSectionName() != null && !other.getSectionName().isBlank()
                ? (" — Section " + other.getSectionName()) : "";
        return cls + sec;
    }

    public List<Timetable> getByAcademicYear(String academicYearId) {
        logger.info("Fetching timetables for academicYearId={}", academicYearId);
        return timetableRepository.findByAcademicYearId(academicYearId);
    }

    public List<Timetable> getByClass(String classId, String academicYearId) {
        logger.info("Fetching timetables for classId={}, academicYearId={}", classId, academicYearId);
        return timetableRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
    }

    public void delete(String timetableId) {
        logger.info("Deleting timetable id={}", timetableId);
        timetableRepository.deleteById(timetableId);
        logger.info("Deleted timetable id={}", timetableId);
    }

    public List<Timetable> getTeacherSchedule(String teacherId, String academicYearId) {
        logger.info("Fetching teacher schedule for teacherId={}, academicYearId={}", teacherId, academicYearId);
        List<Timetable> allTimetables = timetableRepository.findByAcademicYearId(academicYearId);
        List<Timetable> result = new ArrayList<>();

        for (Timetable timetable : allTimetables) {
            if (timetable.getSchedule() == null) {
                continue;
            }
            List<Timetable.DaySchedule> matchingDays = new ArrayList<>();
            for (Timetable.DaySchedule day : timetable.getSchedule()) {
                if (day.getPeriods() == null) {
                    continue;
                }
                List<Timetable.Period> matchingPeriods = new ArrayList<>();
                for (Timetable.Period period : day.getPeriods()) {
                    if (teacherId.equals(period.getTeacherId())) {
                        matchingPeriods.add(period);
                    }
                }
                if (!matchingPeriods.isEmpty()) {
                    Timetable.DaySchedule filteredDay = new Timetable.DaySchedule();
                    filteredDay.setDayOfWeek(day.getDayOfWeek());
                    filteredDay.setPeriods(matchingPeriods);
                    matchingDays.add(filteredDay);
                }
            }
            if (!matchingDays.isEmpty()) {
                Timetable filtered = new Timetable();
                filtered.setTimetableId(timetable.getTimetableId());
                filtered.setClassId(timetable.getClassId());
                filtered.setSectionId(timetable.getSectionId());
                filtered.setAcademicYearId(timetable.getAcademicYearId());
                filtered.setSchedule(matchingDays);
                filtered.setCreatedAt(timetable.getCreatedAt());
                result.add(filtered);
            }
        }

        logger.info("Found {} timetables with periods for teacherId={}", result.size(), teacherId);
        return result;
    }
}
