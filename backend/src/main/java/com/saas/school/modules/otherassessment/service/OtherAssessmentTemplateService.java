package com.saas.school.modules.otherassessment.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.otherassessment.model.OtherAssessment;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Generates the bulk marks-entry Excel template for an Other Assessment.
 *
 * <p>Modelled after the school-supplied reference sheet (School name
 * on top, assessment title below, then Sl.no / Roll / Name / Section /
 * subjects.../ Total / Rank) — but reshaped so the columns line up
 * cleanly with the app's subject list and can be round-tripped back
 * on upload. Total is a live SUM formula so it updates as the admin
 * types marks in Excel; Rank is left blank and computed by the server
 * on save.</p>
 */
@Service
public class OtherAssessmentTemplateService {

    @Autowired private OtherAssessmentService assessmentService;
    @Autowired private SchoolClassRepository classRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private StudentRepository studentRepository;

    /** Build the .xlsx bytes for the given assessment.
     *  Called by the controller and streamed straight to the browser.
     *
     *  @param includeRoll  when {@code true}, the Roll No column is
     *      emitted between Adm No and Name. When {@code false} it's
     *      dropped entirely — useful for schools whose roll numbers
     *      aren't kept clean, since admission number is the reliable
     *      match key on upload anyway. */
    public byte[] buildTemplate(String assessmentId, boolean includeRoll) {
        OtherAssessment doc = assessmentService.get(assessmentId);

        String schoolName = resolveSchoolName();
        String classLabel = resolveClassSectionLabel(doc);

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Marks");

            // Stamp the workbook so the upload-side can verify this
            // file was generated for THIS assessment — prevents an
            // admin accidentally applying test8's sheet to test9 just
            // because the admission numbers happen to match.
            stampAssessmentId(wb, doc.getAssessmentId());

            List<OtherAssessment.SubjectSpec> subjects = doc.getSubjects() == null
                    ? List.of() : doc.getSubjects();

            // Column layout — Section is not a column (the class-section
            // label already lives in the merged row 2 title):
            //   Sl.no | Adm No | Roll | Name | subjects... | Total | Rank
            // The Roll column stays in the header shape either way so
            // the sheet layout doesn't shift between downloads. The
            // {@code includeRoll} flag only controls whether the roll
            // number VALUES are pre-filled; when false, the column is
            // rendered blank for the admin to fill (or leave empty).
            int slCol = 0;
            int admCol = 1;
            int rollCol = 2;
            int nameCol = 3;
            int subjectStart = nameCol + 1;
            int subjectEnd = subjectStart + subjects.size() - 1;  // -1 when no subjects
            int totalCol = subjectStart + subjects.size();
            int rankCol = totalCol + 1;
            int lastCol = rankCol;

            // Backfill admission numbers for legacy assessments whose
            // students[] snapshot predates the field. One Mongo hit per
            // template download beats leaving the column blank.
            Map<String, String> liveAdmissionByStudent = resolveLegacyAdmissions(doc);

            // ── Styles ────────────────────────────────────────────
            CellStyle titleStyle = wb.createCellStyle();
            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle subtitleStyle = wb.createCellStyle();
            Font subtitleFont = wb.createFont();
            subtitleFont.setBold(true);
            subtitleFont.setFontHeightInPoints((short) 12);
            subtitleStyle.setFont(subtitleFont);
            subtitleStyle.setAlignment(HorizontalAlignment.CENTER);
            subtitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            applyAllBorders(headerStyle);

            CellStyle textCell = wb.createCellStyle();
            textCell.setAlignment(HorizontalAlignment.LEFT);
            textCell.setVerticalAlignment(VerticalAlignment.CENTER);
            applyAllBorders(textCell);

            CellStyle numCell = wb.createCellStyle();
            numCell.setAlignment(HorizontalAlignment.CENTER);
            numCell.setVerticalAlignment(VerticalAlignment.CENTER);
            applyAllBorders(numCell);

            CellStyle totalCell = wb.createCellStyle();
            Font totalFont = wb.createFont();
            totalFont.setBold(true);
            totalCell.setFont(totalFont);
            totalCell.setAlignment(HorizontalAlignment.CENTER);
            totalCell.setVerticalAlignment(VerticalAlignment.CENTER);
            applyAllBorders(totalCell);

            // ── Row 1: School name ────────────────────────────────
            Row row1 = sheet.createRow(0);
            row1.setHeightInPoints(28);
            Cell c1 = row1.createCell(0);
            c1.setCellValue(schoolName);
            c1.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, lastCol));

            // ── Row 2: Assessment title ───────────────────────────
            String dateStr = doc.getTestDate() == null ? ""
                    : doc.getTestDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy"));
            StringBuilder subtitle = new StringBuilder();
            if (!classLabel.isBlank()) subtitle.append(classLabel).append("  ");
            if (doc.getType() != null && !doc.getType().isBlank()) subtitle.append(doc.getType()).append("  ");
            if (doc.getName() != null && !doc.getName().isBlank()) subtitle.append(doc.getName());
            if (!dateStr.isBlank()) subtitle.append("  (").append(dateStr).append(")");

            Row row2 = sheet.createRow(1);
            row2.setHeightInPoints(22);
            Cell c2 = row2.createCell(0);
            c2.setCellValue(subtitle.toString().trim());
            c2.setCellStyle(subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, lastCol));

            // ── Row 3: Headers ────────────────────────────────────
            Row header = sheet.createRow(2);
            header.setHeightInPoints(30);
            writeHeader(header, slCol,   "Sl.no",   headerStyle);
            writeHeader(header, admCol,  "Adm No",  headerStyle);
            writeHeader(header, rollCol, "Roll No", headerStyle);
            writeHeader(header, nameCol, "Name",    headerStyle);
            for (int i = 0; i < subjects.size(); i++) {
                Cell h = header.createCell(subjectStart + i);
                var s = subjects.get(i);
                String name = s.getSubjectName() == null ? "" : s.getSubjectName();
                Integer max = s.getMaxMarks();
                h.setCellValue(max != null ? name + "\n(/ " + max + ")" : name);
                h.setCellStyle(headerStyle);
            }
            Cell tHead = header.createCell(totalCol);
            tHead.setCellValue("Total");
            tHead.setCellStyle(headerStyle);
            Cell rHead = header.createCell(rankCol);
            rHead.setCellValue("Rank");
            rHead.setCellStyle(headerStyle);

            // ── Data rows ─────────────────────────────────────────
            List<OtherAssessment.StudentEntry> students = doc.getStudents() == null
                    ? List.of() : doc.getStudents();
            int rowIdx = 3;
            for (int i = 0; i < students.size(); i++) {
                var st = students.get(i);
                Row r = sheet.createRow(rowIdx);
                r.setHeightInPoints(20);

                Cell sl = r.createCell(slCol);
                sl.setCellValue(i + 1);
                sl.setCellStyle(numCell);

                Cell adm = r.createCell(admCol);
                String admission = st.getAdmissionNumber();
                if ((admission == null || admission.isBlank()) && st.getStudentId() != null) {
                    admission = liveAdmissionByStudent.get(st.getStudentId());
                }
                adm.setCellValue(admission == null ? "" : admission);
                adm.setCellStyle(textCell);

                Cell roll = r.createCell(rollCol);
                // Header always present; value only when the admin
                // chose to include it. Blank cell is styled so the
                // grid still lines up on the printed sheet.
                if (includeRoll) {
                    roll.setCellValue(st.getRollNumber() == null ? "" : st.getRollNumber());
                }
                roll.setCellStyle(textCell);

                Cell nm = r.createCell(nameCol);
                nm.setCellValue(st.getFullName() == null ? "" : st.getFullName());
                nm.setCellStyle(textCell);

                for (int j = 0; j < subjects.size(); j++) {
                    Cell mk = r.createCell(subjectStart + j);
                    mk.setCellStyle(numCell);
                }

                // Total = SUM(subject cells). Live formula so the admin
                // sees the running total in Excel while filling.
                Cell tot = r.createCell(totalCol);
                if (subjects.size() > 0) {
                    String firstCol = colLetter(subjectStart);
                    String lastSubjectCol = colLetter(subjectEnd);
                    int excelRow = rowIdx + 1;
                    tot.setCellFormula("SUM(" + firstCol + excelRow + ":" + lastSubjectCol + excelRow + ")");
                }
                tot.setCellStyle(totalCell);

                // Rank left blank — computed by the server on upload.
                Cell rnk = r.createCell(rankCol);
                rnk.setCellStyle(numCell);

                rowIdx++;
            }

            // ── Column widths ─────────────────────────────────────
            sheet.setColumnWidth(slCol,   6 * 256);
            sheet.setColumnWidth(admCol,  14 * 256);
            sheet.setColumnWidth(rollCol, 12 * 256);
            sheet.setColumnWidth(nameCol, 28 * 256);
            for (int i = 0; i < subjects.size(); i++) sheet.setColumnWidth(subjectStart + i, 14 * 256);
            sheet.setColumnWidth(totalCol, 10 * 256);
            sheet.setColumnWidth(rankCol, 8 * 256);

            // Freeze header rows so a large class stays navigable.
            sheet.createFreezePane(0, 3);

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to build template Excel", e);
        }
    }

    /** Returns the .xlsx filename used by the Content-Disposition
     *  header — includes the assessment name so the file is easy to
     *  identify in the admin's Downloads folder. */
    public String buildFilename(String assessmentId) {
        OtherAssessment doc = assessmentService.get(assessmentId);
        String name = doc.getName() == null ? "assessment" : doc.getName();
        String safe = name.replaceAll("[^A-Za-z0-9_-]+", "_").replaceAll("_+", "_");
        return safe + "_template.xlsx";
    }

    // ── Helpers ─────────────────────────────────────────────────

    private String resolveSchoolName() {
        String tenantId = com.saas.school.config.mongodb.TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) return "School";
        // Tenant lives in the master DB; clear the tenant context so
        // the repository doesn't try to route to the tenant DB.
        com.saas.school.config.mongodb.TenantContext.clear();
        try {
            Tenant t = tenantRepository.findById(tenantId).orElse(null);
            return t != null && t.getSchoolName() != null ? t.getSchoolName() : "School";
        } finally {
            com.saas.school.config.mongodb.TenantContext.setTenantId(tenantId);
        }
    }

    /** For legacy assessments whose StudentEntry snapshot predates
     *  the admissionNumber field, look up each student and read the
     *  current admission number. New assessments store the number
     *  directly and this map ends up empty. */
    private Map<String, String> resolveLegacyAdmissions(OtherAssessment doc) {
        Map<String, String> out = new HashMap<>();
        if (doc.getStudents() == null) return out;
        List<String> missingIds = new java.util.ArrayList<>();
        for (var s : doc.getStudents()) {
            if (s.getStudentId() == null) continue;
            String snapshotted = s.getAdmissionNumber();
            if (snapshotted == null || snapshotted.isBlank()) missingIds.add(s.getStudentId());
        }
        if (missingIds.isEmpty()) return out;
        List<Student> live = studentRepository.findByStudentIdInAndDeletedAtIsNull(missingIds);
        for (Student s : live) {
            if (s.getStudentId() != null && s.getAdmissionNumber() != null) {
                out.put(s.getStudentId(), s.getAdmissionNumber());
            }
        }
        return out;
    }

    private String resolveClassSectionLabel(OtherAssessment doc) {
        if (doc.getClassId() == null) return "";
        SchoolClass sc = classRepository.findById(doc.getClassId()).orElse(null);
        if (sc == null) return "";
        String className = sc.getName() == null ? "" : sc.getName();
        String sectionName = "";
        if (doc.getSectionId() != null && sc.getSections() != null) {
            for (SchoolClass.Section s : sc.getSections()) {
                if (doc.getSectionId().equals(s.getSectionId())) {
                    sectionName = s.getName() == null ? "" : s.getName();
                    break;
                }
            }
        }
        return sectionName.isBlank() ? className : (className + " " + sectionName).trim();
    }

    /** Write the assessment identity into the workbook's custom
     *  document properties. Invisible to admins editing the sheet in
     *  Excel, survives round-trips through Excel / LibreOffice, and
     *  lets the upload endpoint reject sheets that were generated
     *  for a different assessment. */
    private void stampAssessmentId(XSSFWorkbook wb, String assessmentId) {
        if (assessmentId == null) return;
        var props = wb.getProperties().getCustomProperties();
        props.addProperty("nvOtherAssessmentId", assessmentId);
    }

    private void writeHeader(Row header, int col, String label, CellStyle style) {
        Cell h = header.createCell(col);
        h.setCellValue(label);
        h.setCellStyle(style);
    }

    private void applyAllBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }

    /** POI's CellReference.convertNumToColString is available but we
     *  only need the simple 0..25 case here — keeps the call site
     *  legible with the row number appended right after. */
    private String colLetter(int zeroBasedCol) {
        StringBuilder sb = new StringBuilder();
        int n = zeroBasedCol;
        while (n >= 0) {
            sb.insert(0, (char) ('A' + (n % 26)));
            n = (n / 26) - 1;
        }
        return sb.toString();
    }
}
