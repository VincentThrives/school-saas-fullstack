package com.saas.school.modules.timetable.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "timetable")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Timetable {
    @Id private String timetableId;
    private String classId;
    private String className;
    private String sectionId;
    private String sectionName;
    private String academicYearId;
    private List<DaySchedule> schedule;
    /**
     * Per-timetable schedule shape — first period start, period length,
     * where lunch sits, and how times should be displayed (12h vs 24h).
     * Null on legacy docs created before this field existed; the builder
     * UI shows sensible defaults (8:00 start, 45 min, lunch after period 4,
     * 12-hour display) when null so existing flows don't regress.
     */
    private ScheduleConfig scheduleConfig;
    @CreatedDate private Instant createdAt;

    public Timetable() {
    }

    public Timetable(String timetableId, String classId, String sectionId, String academicYearId,
                     List<DaySchedule> schedule, Instant createdAt) {
        this.timetableId = timetableId;
        this.classId = classId;
        this.sectionId = sectionId;
        this.academicYearId = academicYearId;
        this.schedule = schedule;
        this.createdAt = createdAt;
    }

    public String getTimetableId() { return timetableId; }
    public void setTimetableId(String timetableId) { this.timetableId = timetableId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public List<DaySchedule> getSchedule() { return schedule; }
    public void setSchedule(List<DaySchedule> schedule) { this.schedule = schedule; }

    public ScheduleConfig getScheduleConfig() { return scheduleConfig; }
    public void setScheduleConfig(ScheduleConfig scheduleConfig) { this.scheduleConfig = scheduleConfig; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    /**
     * Embedded shape config — controls where lunch goes, what time periods
     * start, and how times render to admins and parents. Editable on the
     * Timetable Builder's "Schedule settings" panel; every field is
     * optional with the per-field defaults documented inline.
     *
     * <p>Why embedded (not a separate doc): different sections in the same
     * school commonly run on different shapes — primary classes might end
     * earlier than secondary, kindergarten skips lunch entirely — so the
     * config tracks 1:1 with each Timetable rather than living on a
     * per-tenant settings doc. Keeping it inline also avoids an extra
     * round-trip on every render of the builder.</p>
     */
    public static class ScheduleConfig {
        /** First period's start time as "HH:mm" (24-hour). Default {@code "08:00"}. */
        private String firstPeriodStart;
        /** Period length in minutes. Drives the "add period" button's
         *  default end time + any auto-fill in the builder. Default {@code 45}. */
        private Integer periodDurationMinutes;
        /** Number of teaching periods that come BEFORE the lunch break.
         *  {@code 4} means lunch sits between periods 4 and 5. {@code 0}
         *  disables the lunch row entirely (kindergarten, half-day classes).
         *  Default {@code 4}. */
        private Integer periodsBeforeLunch;
        /** Lunch break start time as "HH:mm" (24-hour). Default {@code "11:00"}. */
        private String lunchStart;
        /** Lunch break end time as "HH:mm" (24-hour). Default {@code "11:30"}. */
        private String lunchEnd;
        /** Display format hint for the frontend — {@code "h12"} renders
         *  "1:00 PM", {@code "h24"} renders "13:00". The DB always stores
         *  "HH:mm" 24-hour strings; this only affects rendering. Default
         *  {@code "h12"} (Indian schools convention). */
        private String displayTimeFormat;

        /** Number of periods for this schedule. Only meaningful inside a
         *  per-day override — Saturday may want 4 periods while Mon–Fri
         *  run 7. Null on the outer config falls back to the historical
         *  {@code periodsBeforeLunch + 4}. */
        private Integer periodsCount;

        /**
         * Optional per-day overrides — the map key is the day name
         * (MONDAY, TUESDAY, ..., SATURDAY, matched case-insensitively).
         * When present for a given day, that day uses the override's
         * fields instead of the outer ones — this lets Saturday run on
         * a shorter timetable (later start, 30-min periods, earlier
         * lunch, 4 periods total) without affecting Mon–Fri.
         *
         * <p>Legacy timetables have this null → every day uses the outer
         * config as before. The nested {@link ScheduleConfig#getPerDayOverrides()}
         * on an override object is intentionally ignored (no recursion).</p>
         */
        private java.util.Map<String, ScheduleConfig> perDayOverrides;

        public ScheduleConfig() {}

        public String getFirstPeriodStart() { return firstPeriodStart; }
        public void setFirstPeriodStart(String firstPeriodStart) { this.firstPeriodStart = firstPeriodStart; }

        public Integer getPeriodDurationMinutes() { return periodDurationMinutes; }
        public void setPeriodDurationMinutes(Integer periodDurationMinutes) { this.periodDurationMinutes = periodDurationMinutes; }

        public Integer getPeriodsBeforeLunch() { return periodsBeforeLunch; }
        public void setPeriodsBeforeLunch(Integer periodsBeforeLunch) { this.periodsBeforeLunch = periodsBeforeLunch; }

        public String getLunchStart() { return lunchStart; }
        public void setLunchStart(String lunchStart) { this.lunchStart = lunchStart; }

        public String getLunchEnd() { return lunchEnd; }
        public void setLunchEnd(String lunchEnd) { this.lunchEnd = lunchEnd; }

        public String getDisplayTimeFormat() { return displayTimeFormat; }
        public void setDisplayTimeFormat(String displayTimeFormat) { this.displayTimeFormat = displayTimeFormat; }

        public Integer getPeriodsCount() { return periodsCount; }
        public void setPeriodsCount(Integer periodsCount) { this.periodsCount = periodsCount; }

        public java.util.Map<String, ScheduleConfig> getPerDayOverrides() { return perDayOverrides; }
        public void setPerDayOverrides(java.util.Map<String, ScheduleConfig> perDayOverrides) { this.perDayOverrides = perDayOverrides; }
    }

    public static class DaySchedule {
        private String dayOfWeek;
        private List<Period> periods;

        public DaySchedule() {
        }

        public DaySchedule(String dayOfWeek, List<Period> periods) {
            this.dayOfWeek = dayOfWeek;
            this.periods = periods;
        }

        public String getDayOfWeek() { return dayOfWeek; }
        public void setDayOfWeek(String dayOfWeek) { this.dayOfWeek = dayOfWeek; }

        public List<Period> getPeriods() { return periods; }
        public void setPeriods(List<Period> periods) { this.periods = periods; }
    }

    public static class Period {
        private int periodNumber;
        private String startTime;
        private String endTime;
        private String subjectId;
        private String subjectName;
        private String teacherId;
        private String teacherName;
        private String roomNumber;
        /**
         * For hybrid subjects (e.g. Math with Theory + Practical that both
         * track attendance), the timetable slot declares WHICH slice this
         * period is for. Attendance and other downstream consumers read
         * this directly — no second prompt on the attendance page.
         * Null/blank for single-component subjects or pre-component periods.
         */
        private String componentKey;
        /** Human-readable label cache for componentKey ("Theory" / "Practical"). */
        private String componentLabel;
        /**
         * Optional teaching-side slice — Physics / Chemistry / Biology
         * inside an integrated Science course. Set when the subject
         * carries {@code Subject.subParts} and this slot is for one of
         * them. Orthogonal to {@link #componentKey} (Theory / Practical):
         * a Science Physics period stores {@code subPartKey = "physics"}
         * and {@code componentKey = null} (or carries one too for very
         * elaborate setups). Attendance routes via this field
         * automatically, so the teacher who opens this period gets a
         * Physics-scoped attendance form. Null for subjects without
         * sub-parts — pre-existing periods deserialise unchanged.
         */
        private String subPartKey;
        /** Human-readable label cache for subPartKey ("Physics", "Chemistry"). */
        private String subPartLabel;

        /**
         * Free-text label for activity slots (Reading, Writing, Library,
         * PE, Drawing, Assembly, ...). When set, {@link #subjectId} and
         * {@link #teacherId} MAY be null — no teaching subject, no
         * assigned teacher. Attendance, exams, marks entry, and report
         * cards all key off subjectId, so activity periods are naturally
         * skipped by every downstream flow. Null for regular teaching
         * periods — pre-existing timetables deserialise unchanged.
         */
        private String activityLabel;

        public Period() {
        }

        public Period(int periodNumber, String startTime, String endTime, String subjectId, String teacherId,
                      String roomNumber) {
            this.periodNumber = periodNumber;
            this.startTime = startTime;
            this.endTime = endTime;
            this.subjectId = subjectId;
            this.teacherId = teacherId;
            this.roomNumber = roomNumber;
        }

        public int getPeriodNumber() { return periodNumber; }
        public void setPeriodNumber(int periodNumber) { this.periodNumber = periodNumber; }

        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }

        public String getEndTime() { return endTime; }
        public void setEndTime(String endTime) { this.endTime = endTime; }

        public String getSubjectId() { return subjectId; }
        public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

        public String getSubjectName() { return subjectName; }
        public void setSubjectName(String subjectName) { this.subjectName = subjectName; }

        public String getTeacherId() { return teacherId; }
        public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

        public String getTeacherName() { return teacherName; }
        public void setTeacherName(String teacherName) { this.teacherName = teacherName; }

        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

        public String getComponentKey() { return componentKey; }
        public void setComponentKey(String componentKey) { this.componentKey = componentKey; }

        public String getComponentLabel() { return componentLabel; }
        public void setComponentLabel(String componentLabel) { this.componentLabel = componentLabel; }

        public String getSubPartKey() { return subPartKey; }
        public void setSubPartKey(String subPartKey) { this.subPartKey = subPartKey; }

        public String getSubPartLabel() { return subPartLabel; }
        public void setSubPartLabel(String subPartLabel) { this.subPartLabel = subPartLabel; }

        public String getActivityLabel() { return activityLabel; }
        public void setActivityLabel(String activityLabel) { this.activityLabel = activityLabel; }
    }
}
