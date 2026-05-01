package com.saas.school.modules.timetable.service;

import com.saas.school.modules.classes.repository.SchoolClassRepository;
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
