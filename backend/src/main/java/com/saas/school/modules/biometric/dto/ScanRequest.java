package com.saas.school.modules.biometric.dto;

import com.saas.school.modules.biometric.model.AttendanceScan;

/**
 * Scan payload from the kiosk. For CARD scans the tablet fills
 * {@link #cardUid}; for FACE scans it fills {@link #matchedStudentId}
 * (the tablet already did the face-vector comparison locally against
 * the morning roster).
 */
public class ScanRequest {
    private AttendanceScan.ScanMethod method;
    private String cardUid;
    private String matchedStudentId;
    /** ISO instant. Optional — server uses now() if absent. */
    private String scannedAt;

    public AttendanceScan.ScanMethod getMethod() { return method; }
    public void setMethod(AttendanceScan.ScanMethod method) { this.method = method; }

    public String getCardUid() { return cardUid; }
    public void setCardUid(String cardUid) { this.cardUid = cardUid; }

    public String getMatchedStudentId() { return matchedStudentId; }
    public void setMatchedStudentId(String matchedStudentId) { this.matchedStudentId = matchedStudentId; }

    public String getScannedAt() { return scannedAt; }
    public void setScannedAt(String scannedAt) { this.scannedAt = scannedAt; }
}
