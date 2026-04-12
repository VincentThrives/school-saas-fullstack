package com.saas.school.modules.timetable.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;

@Document(collection = "timetable")
public class Timetable {
    @Id private String timetableId;
    private String classId;
    private String sectionId;
    private String academicYearId;
    private List<DaySchedule> schedule;
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

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public List<DaySchedule> getSchedule() { return schedule; }
    public void setSchedule(List<DaySchedule> schedule) { this.schedule = schedule; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

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
        private String teacherId;
        private String roomNumber;

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

        public String getTeacherId() { return teacherId; }
        public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
    }
}
