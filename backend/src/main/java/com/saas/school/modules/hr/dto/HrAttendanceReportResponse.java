package com.saas.school.modules.hr.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Wrapper returned by the HR Attendance Report endpoint. Bundles the
 * daily rows with the set of tenant-declared holiday dates that
 * overlap the picked range, so the frontend can:
 * <ol>
 *   <li>Show holiday cells distinctly in the detailed grid.</li>
 *   <li>Compute {@code workingDays = totalDays − sundays − holidays}
 *       and use that as the denominator for the attendance %.</li>
 *   <li>Award working-day credit to any employee who has a row on a
 *       Sunday / holiday (they came in on the off-day).</li>
 * </ol>
 *
 * <p>Kept small on purpose — just the row list + a flat date list.
 * No per-holiday metadata (name / description) here; the frontend
 * only needs the calendar-day set for the calc.</p>
 */
public class HrAttendanceReportResponse {

    private List<HrDailyAttendanceDto> rows;
    /** yyyy-MM-dd dates within the requested range that fall on a
     *  declared holiday. Multi-day holidays are expanded — one entry
     *  per calendar day the frontend has to render. */
    private List<LocalDate> holidayDates;
    /** {@code name} for each holiday date — indexed alongside
     *  {@link #holidayDates}. Empty string when the event carries
     *  no title. Used for the tooltip in the day-by-day dialog. */
    private List<String> holidayNames;

    public HrAttendanceReportResponse() {}

    public HrAttendanceReportResponse(List<HrDailyAttendanceDto> rows,
                                      List<LocalDate> holidayDates,
                                      List<String> holidayNames) {
        this.rows = rows;
        this.holidayDates = holidayDates;
        this.holidayNames = holidayNames;
    }

    public List<HrDailyAttendanceDto> getRows() { return rows; }
    public void setRows(List<HrDailyAttendanceDto> rows) { this.rows = rows; }

    public List<LocalDate> getHolidayDates() { return holidayDates; }
    public void setHolidayDates(List<LocalDate> holidayDates) { this.holidayDates = holidayDates; }

    public List<String> getHolidayNames() { return holidayNames; }
    public void setHolidayNames(List<String> holidayNames) { this.holidayNames = holidayNames; }
}
