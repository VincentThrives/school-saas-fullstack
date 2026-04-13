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
            timetable.setTimetableId(UUID.randomUUID().toString());
            logger.info("Saving new timetable with generated id={}", timetable.getTimetableId());
        } else {
            logger.info("Saving timetable id={}", timetable.getTimetableId());
        }
        return timetableRepository.save(timetable);
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
