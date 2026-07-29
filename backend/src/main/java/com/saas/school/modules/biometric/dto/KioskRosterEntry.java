package com.saas.school.modules.biometric.dto;

import java.util.List;

/** One row of the morning roster bundle the kiosk pulls once at boot.
 *  Contains everything the tablet needs to identify a face or card
 *  locally + render a rich welcome card without hitting the backend. */
public class KioskRosterEntry {
    private String studentId;
    private String name;
    private String rollNumber;
    private String className;
    private String cardUid;
    private String photoBase64;
    private List<Double> faceEmbedding;

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getCardUid() { return cardUid; }
    public void setCardUid(String cardUid) { this.cardUid = cardUid; }

    public String getPhotoBase64() { return photoBase64; }
    public void setPhotoBase64(String photoBase64) { this.photoBase64 = photoBase64; }

    public List<Double> getFaceEmbedding() { return faceEmbedding; }
    public void setFaceEmbedding(List<Double> faceEmbedding) { this.faceEmbedding = faceEmbedding; }
}
