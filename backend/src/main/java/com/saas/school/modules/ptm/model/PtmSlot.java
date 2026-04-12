package com.saas.school.modules.ptm.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "ptm_slots")
public class PtmSlot {

    @Id
    private String id;
    private String ptmScheduleId;
    private String teacherId;
    private String teacherName;
    private String startTime;
    private String endTime;
    private String parentId;
    private String parentName;
    private String studentId;
    private String studentName;
    private SlotStatus status;
    private String remarks;
    private Instant bookedAt;

    public PtmSlot() {
    }

    // ── Getters and Setters ───────────────────────────────────────

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPtmScheduleId() {
        return ptmScheduleId;
    }

    public void setPtmScheduleId(String ptmScheduleId) {
        this.ptmScheduleId = ptmScheduleId;
    }

    public String getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(String teacherId) {
        this.teacherId = teacherId;
    }

    public String getTeacherName() {
        return teacherName;
    }

    public void setTeacherName(String teacherName) {
        this.teacherName = teacherName;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public SlotStatus getStatus() {
        return status;
    }

    public void setStatus(SlotStatus status) {
        this.status = status;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public Instant getBookedAt() {
        return bookedAt;
    }

    public void setBookedAt(Instant bookedAt) {
        this.bookedAt = bookedAt;
    }

    // ── Nested types ──────────────────────────────────────────────

    public enum SlotStatus {
        AVAILABLE, BOOKED, COMPLETED, CANCELLED
    }
}
