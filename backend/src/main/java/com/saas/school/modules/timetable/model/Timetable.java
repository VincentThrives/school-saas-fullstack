package com.saas.school.modules.timetable.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant; import java.util.List;
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "timetable")
public class Timetable {
    @Id private String timetableId;
    private String classId, sectionId, academicYearId;
    private List<DaySchedule> schedule;
    @CreatedDate private Instant createdAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DaySchedule {
        private String dayOfWeek;
        private List<Period> periods;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Period {
        private int periodNumber;
        private String startTime, endTime, subjectId, teacherId, roomNumber;
    }
}