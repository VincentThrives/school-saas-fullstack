package com.saas.school.modules.sms.dto;

import java.util.List;

/**
 * One row in the "Today's absent students" picker on the SMS Notifications
 * page. The school admin uses this list to choose who actually gets an
 * absence-alert SMS — replacing the old fire-on-save behaviour with an
 * explicit, deduped, end-of-day batch.
 *
 * <p>Deduplication is keyed on {@code studentId}: a student absent in
 * three periods today shows up once with the periods array filled in,
 * so the parent only ever gets a single SMS for the day.</p>
 *
 * <p>{@link #alreadySent} is set by the backend when an audit log entry
 * already exists for this student today — the frontend pre-unchecks
 * those rows and shows a "Already sent" badge. If the admin overrides
 * and ticks them anyway, the dispatch endpoint silently skips them via
 * the same idempotency guard.</p>
 */
public class AbsentTodayDto {

    private String studentId;
    private String studentName;
    private String admissionNumber;
    private String classLabel;       // e.g. "Class 10-A"
    private String parentName;
    private String parentPhoneMasked; // "+9178•••••0602" — safe to display
    private List<Integer> absentPeriods;  // empty if only day-wise
    private boolean dayWise;         // true if marked absent for period 0 (whole day)
    private boolean hasValidPhone;   // false → row shown but checkbox disabled
    private boolean alreadySent;     // true → row pre-unchecked + badge

    public AbsentTodayDto() {}

    // ── Getters / setters ──────────────────────────────────────

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getAdmissionNumber() { return admissionNumber; }
    public void setAdmissionNumber(String admissionNumber) { this.admissionNumber = admissionNumber; }

    public String getClassLabel() { return classLabel; }
    public void setClassLabel(String classLabel) { this.classLabel = classLabel; }

    public String getParentName() { return parentName; }
    public void setParentName(String parentName) { this.parentName = parentName; }

    public String getParentPhoneMasked() { return parentPhoneMasked; }
    public void setParentPhoneMasked(String parentPhoneMasked) { this.parentPhoneMasked = parentPhoneMasked; }

    public List<Integer> getAbsentPeriods() { return absentPeriods; }
    public void setAbsentPeriods(List<Integer> absentPeriods) { this.absentPeriods = absentPeriods; }

    public boolean isDayWise() { return dayWise; }
    public void setDayWise(boolean dayWise) { this.dayWise = dayWise; }

    public boolean isHasValidPhone() { return hasValidPhone; }
    public void setHasValidPhone(boolean hasValidPhone) { this.hasValidPhone = hasValidPhone; }

    public boolean isAlreadySent() { return alreadySent; }
    public void setAlreadySent(boolean alreadySent) { this.alreadySent = alreadySent; }
}
