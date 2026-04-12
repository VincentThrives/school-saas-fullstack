package com.saas.school.modules.mentoring.model;

import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "mentoring_notes")
public class MentoringNote {
    @Id private String noteId;
    private String studentId;
    private String teacherId;
    private String note;
    private Category category;
    private boolean isFlagged;
    @CreatedDate private Instant createdAt;

    public enum Category { ACADEMIC, BEHAVIORAL, ATTENDANCE, HEALTH, OTHER }

    public MentoringNote() {
    }

    public MentoringNote(String noteId, String studentId, String teacherId, String note, Category category,
                         boolean isFlagged, Instant createdAt) {
        this.noteId = noteId;
        this.studentId = studentId;
        this.teacherId = teacherId;
        this.note = note;
        this.category = category;
        this.isFlagged = isFlagged;
        this.createdAt = createdAt;
    }

    public String getNoteId() { return noteId; }
    public void setNoteId(String noteId) { this.noteId = noteId; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getTeacherId() { return teacherId; }
    public void setTeacherId(String teacherId) { this.teacherId = teacherId; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public boolean isFlagged() { return isFlagged; }
    public void setFlagged(boolean isFlagged) { this.isFlagged = isFlagged; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
