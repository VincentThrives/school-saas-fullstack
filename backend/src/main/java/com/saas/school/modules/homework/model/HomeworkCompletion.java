package com.saas.school.modules.homework.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One document per homework notification tracking which students have
 * completed it. Batched shape (entries array) mirrors how attendance
 * rows are stored — a single doc read gives the whole roster status
 * for a class-sized homework.
 *
 * <p>Lazy: not created at homework send time. First teacher toggle
 * creates the doc; subsequent toggles update the matching entry in
 * place. Missing doc → treat every student as not-done.</p>
 */
@Document(collection = "homework_completions")
@CompoundIndexes({
    // Class-scoped analytics ("how many homeworks has 10-A had this week")
    // ride this index directly. Descending updatedAt so the newest rows
    // surface first for teacher dashboards.
    @CompoundIndex(name = "class_section_updated",
        def = "{'classId':1,'sectionId':1,'updatedAt':-1}")
})
public class HomeworkCompletion {
    @Id
    private String completionId;

    /** FK to Notification.notificationId (the HOMEWORK notification). */
    @Indexed(unique = true)
    private String homeworkId;

    /** The section this homework was sent to. Captured from the
     *  notification's recipientClassId + recipientSectionId at first
     *  roster open, and used to enumerate the expected roster. */
    private String classId;
    private String sectionId;

    /** Per-student done markers. Lazy: only students whose status has
     *  ever been toggled show up here — everyone else is implicitly
     *  "not done". Rendered length is bounded by class size
     *  (30-60 typically), well within Mongo's 16 MB doc cap. */
    private List<Entry> entries = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public HomeworkCompletion() {}

    public String getCompletionId() { return completionId; }
    public void setCompletionId(String completionId) { this.completionId = completionId; }

    public String getHomeworkId() { return homeworkId; }
    public void setHomeworkId(String homeworkId) { this.homeworkId = homeworkId; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public List<Entry> getEntries() { return entries; }
    public void setEntries(List<Entry> entries) { this.entries = entries; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    /** Three-state completion status per student. Replaces the earlier
     *  boolean so we can distinguish "half done" from a full pass or a
     *  no-show — teachers often want a middle option for partial work. */
    public enum Status { DONE, HALF, PENDING }

    /** Per-student completion record. Only present in the array once
     *  the student's status has been toggled or their remark filled in
     *  at least once. */
    public static class Entry {
        private String studentId;
        private Status status;
        /** Free-text teacher note per student ("poor handwriting",
         *  "absent today"). Optional; blank/null when nothing to note. */
        private String remark;
        /** userId of whoever toggled — teacher for now, student later
         *  if we ever add self-mark. */
        private String markedBy;
        private Instant markedAt;

        public Entry() {}

        public Entry(String studentId, Status status, String remark, String markedBy, Instant markedAt) {
            this.studentId = studentId;
            this.status = status;
            this.remark = remark;
            this.markedBy = markedBy;
            this.markedAt = markedAt;
        }

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }

        public Status getStatus() { return status; }
        public void setStatus(Status status) { this.status = status; }

        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }

        public String getMarkedBy() { return markedBy; }
        public void setMarkedBy(String markedBy) { this.markedBy = markedBy; }

        public Instant getMarkedAt() { return markedAt; }
        public void setMarkedAt(Instant markedAt) { this.markedAt = markedAt; }
    }
}
