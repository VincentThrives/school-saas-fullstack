package com.saas.school.modules.notification.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Audit row for the "Publish Result" notification flow. One row per
 * (examType, classId, sectionId, subjectId) so the admin can see at a
 * glance whether a result has already been published, and a re-publish
 * is an explicit action rather than a silent duplicate.
 *
 * The unique index uses sentinel "__ALL__" for the subjectId in the
 * combined-result case (subject = All Subjects) so MongoDB can enforce
 * the uniqueness even though Spring Data won't index nulls reliably.
 */
@Document(collection = "result_publications")
@CompoundIndexes({
    @CompoundIndex(
        name = "scope_unique",
        def = "{'examType':1,'classId':1,'sectionId':1,'subjectIdKey':1}",
        unique = true
    )
})
public class ResultPublication {

    /** Sentinel written into subjectIdKey when the publication covers all
     *  subjects of an exam type — the real subjectId field is null in
     *  that case but the index needs a non-null value to enforce
     *  uniqueness, so we duplicate. */
    public static final String ALL_SUBJECTS_KEY = "__ALL__";

    @Id
    private String id;

    private String examType;
    private String classId;
    private String sectionId;
    /** null when the publication covers every subject. */
    private String subjectId;
    /** Always populated — equals subjectId, or {@link #ALL_SUBJECTS_KEY}
     *  when subjectId is null. Backs the compound index. */
    private String subjectIdKey;

    private String academicYearId;
    private String publishedBy;
    private Instant publishedAt;
    private int studentsNotified;
    private int parentsNotified;
    private int examsCovered;
    /** Bumped each time this scope is re-published. 1 on first publish. */
    private int publishCount;

    public ResultPublication() {}

    // ── Getters / setters ──────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getExamType() { return examType; }
    public void setExamType(String examType) { this.examType = examType; }

    public String getClassId() { return classId; }
    public void setClassId(String classId) { this.classId = classId; }

    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) {
        this.subjectId = subjectId;
        this.subjectIdKey = (subjectId == null || subjectId.isBlank())
                ? ALL_SUBJECTS_KEY : subjectId;
    }

    public String getSubjectIdKey() { return subjectIdKey; }
    public void setSubjectIdKey(String subjectIdKey) { this.subjectIdKey = subjectIdKey; }

    public String getAcademicYearId() { return academicYearId; }
    public void setAcademicYearId(String academicYearId) { this.academicYearId = academicYearId; }

    public String getPublishedBy() { return publishedBy; }
    public void setPublishedBy(String publishedBy) { this.publishedBy = publishedBy; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

    public int getStudentsNotified() { return studentsNotified; }
    public void setStudentsNotified(int studentsNotified) { this.studentsNotified = studentsNotified; }

    public int getParentsNotified() { return parentsNotified; }
    public void setParentsNotified(int parentsNotified) { this.parentsNotified = parentsNotified; }

    public int getExamsCovered() { return examsCovered; }
    public void setExamsCovered(int examsCovered) { this.examsCovered = examsCovered; }

    public int getPublishCount() { return publishCount; }
    public void setPublishCount(int publishCount) { this.publishCount = publishCount; }
}
