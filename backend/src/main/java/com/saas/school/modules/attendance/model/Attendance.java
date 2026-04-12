package com.saas.school.modules.attendance.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; 
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "attendance")
@CompoundIndexes({
    @CompoundIndex(name="student_date", def="{'studentId':1,'date':1}", unique=true)
})
public class Attendance {
    @Id private String attendanceId;
    private String studentId, classId, sectionId, academicYearId;
    private LocalDate date;
    private Status status;
    private String markedBy, remarks;
    @CreatedDate private Instant createdAt;
    @LastModifiedDate private Instant updatedAt;
    public enum Status { PRESENT, ABSENT, LATE, HALF_DAY, HOLIDAY }
}