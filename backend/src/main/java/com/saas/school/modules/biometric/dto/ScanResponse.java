package com.saas.school.modules.biometric.dto;

/** Response the kiosk shows on a good scan — student's name and photo
 *  (so the welcome card is rich), status label, and whether we had
 *  already marked them today. */
public class ScanResponse {
    private String studentId;
    private String name;
    private String rollNumber;
    private String className;
    private String photoBase64;
    private String status;          // PRESENT / LATE
    private String scannedAt;       // ISO instant
    private boolean alreadyMarked;
    private String method;          // CARD / FACE

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }

    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }

    public String getPhotoBase64() { return photoBase64; }
    public void setPhotoBase64(String photoBase64) { this.photoBase64 = photoBase64; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getScannedAt() { return scannedAt; }
    public void setScannedAt(String scannedAt) { this.scannedAt = scannedAt; }

    public boolean isAlreadyMarked() { return alreadyMarked; }
    public void setAlreadyMarked(boolean alreadyMarked) { this.alreadyMarked = alreadyMarked; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
}
