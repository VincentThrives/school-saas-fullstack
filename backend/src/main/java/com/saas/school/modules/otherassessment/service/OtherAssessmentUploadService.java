package com.saas.school.modules.otherassessment.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.otherassessment.model.OtherAssessment;
import com.saas.school.modules.otherassessment.repository.OtherAssessmentRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Parses a filled-in bulk-marks .xlsx and merges the marks back into an
 * Other Assessment. Match key is the <b>Admission No</b> column — Roll
 * No is not reliable across schools, so we don't fall back to it.
 *
 * <p>Header-driven mapping — the parser reads row 3 to find the Adm No
 * column and each subject column by name. This survives schools that
 * reorder columns in Excel, so long as the header labels stay intact.
 * Students in the assessment doc who don't appear in the uploaded
 * sheet are left untouched (their existing marks stand).</p>
 */
@Service
public class OtherAssessmentUploadService {

    @Autowired private OtherAssessmentService assessmentService;
    @Autowired private OtherAssessmentRepository assessmentRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private AuditService auditService;

    /**
     * Merge marks from the uploaded workbook into the assessment.
     * Returns a summary of what matched, what didn't, and any bad rows
     * so the admin can act on unmatched students.
     */
    public UploadResult upload(String assessmentId, MultipartFile file, String userId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Upload file is required.");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".xlsx")) {
            throw new BusinessException("Only .xlsx files are supported.");
        }

        OtherAssessment doc = assessmentService.get(assessmentId);
        List<OtherAssessment.SubjectSpec> subjects = doc.getSubjects() == null
                ? List.of() : doc.getSubjects();

        UploadResult result = new UploadResult();

        try (InputStream in = file.getInputStream();
             Workbook wb = new XSSFWorkbook(in)) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet == null) throw new BusinessException("Workbook has no sheets.");

            // Cross-assessment safety net — the template stamps its
            // source assessmentId into the workbook's custom document
            // properties. If present and non-matching, refuse the
            // upload so an admin can't accidentally overwrite a
            // different assessment's marks just because admission
            // numbers happen to match.
            String stampedId = readStampedAssessmentId((XSSFWorkbook) wb);
            if (stampedId != null && !stampedId.equals(assessmentId)) {
                throw new BusinessException(
                        "This file was generated for a different assessment. "
                        + "Download the template for '" + doc.getName()
                        + "' and try again.");
            }
            // Fallback for files whose stamp was stripped (rare — some
            // third-party tools drop custom properties). Compare the
            // subtitle in row 2 against this assessment's name; a
            // clear mismatch is safer to reject than to silently apply.
            if (stampedId == null) {
                String subtitle = cellText(sheet.getRow(1) == null ? null : sheet.getRow(1).getCell(0));
                if (!subtitle.isBlank() && doc.getName() != null
                        && !subtitle.toLowerCase(Locale.ROOT).contains(doc.getName().toLowerCase(Locale.ROOT))) {
                    throw new BusinessException(
                            "This file doesn't look like the template for '" + doc.getName()
                            + "'. Download a fresh template and try again.");
                }
            }

            // Header row is the third one in our template (rows 0, 1
            // hold the school/title). Walk the first ~10 rows to find
            // the header — resilient against schools that add or
            // remove a title row before uploading.
            int headerRowIdx = findHeaderRow(sheet);
            if (headerRowIdx < 0) {
                throw new BusinessException(
                        "Could not find header row. Expected 'Adm No' and subject columns.");
            }
            Row header = sheet.getRow(headerRowIdx);

            Map<String, Integer> colByHeader = new HashMap<>();
            for (int c = 0; c < header.getLastCellNum(); c++) {
                Cell cell = header.getCell(c);
                String txt = cellText(cell).trim();
                if (!txt.isBlank()) colByHeader.put(normaliseHeader(txt), c);
            }

            Integer admCol = firstMatching(colByHeader, "admno", "admissionno", "admission");
            if (admCol == null) {
                throw new BusinessException(
                        "Admission No column not found in the header row.");
            }

            // Map each doc subject to its column in the sheet by name.
            Map<String, Integer> colBySubjectId = new HashMap<>();
            List<String> missingSubjectHeaders = new ArrayList<>();
            for (var s : subjects) {
                String key = normaliseHeader(s.getSubjectName());
                Integer col = colByHeader.get(key);
                if (col == null) missingSubjectHeaders.add(s.getSubjectName());
                else colBySubjectId.put(s.getSubjectId(), col);
            }
            if (!missingSubjectHeaders.isEmpty() && colBySubjectId.isEmpty()) {
                throw new BusinessException(
                        "None of the subject columns were found. Expected: "
                        + String.join(", ", missingSubjectHeaders));
            }

            // Build an index of the assessment's students by admission
            // number so lookups from the uploaded sheet are O(1). For
            // legacy assessments whose StudentEntry snapshot predates
            // the admissionNumber field we fall back to a bulk lookup
            // on the live Student collection and backfill the snapshot
            // so subsequent uploads don't pay the cost again.
            Map<String, OtherAssessment.StudentEntry> studentByAdm = new HashMap<>();
            List<String> studentsNeedingLiveAdm = new ArrayList<>();
            if (doc.getStudents() != null) {
                for (var s : doc.getStudents()) {
                    String adm = s.getAdmissionNumber();
                    if (adm != null && !adm.isBlank()) {
                        studentByAdm.put(adm.trim(), s);
                    } else if (s.getStudentId() != null) {
                        studentsNeedingLiveAdm.add(s.getStudentId());
                    }
                }
            }
            if (!studentsNeedingLiveAdm.isEmpty()) {
                Map<String, String> live = new HashMap<>();
                for (Student live1 : studentRepository
                        .findByStudentIdInAndDeletedAtIsNull(studentsNeedingLiveAdm)) {
                    if (live1.getStudentId() != null && live1.getAdmissionNumber() != null) {
                        live.put(live1.getStudentId(), live1.getAdmissionNumber());
                    }
                }
                for (var s : doc.getStudents()) {
                    String adm = s.getAdmissionNumber();
                    if ((adm == null || adm.isBlank()) && s.getStudentId() != null) {
                        String liveAdm = live.get(s.getStudentId());
                        if (liveAdm != null && !liveAdm.isBlank()) {
                            s.setAdmissionNumber(liveAdm);   // backfill snapshot
                            studentByAdm.put(liveAdm.trim(), s);
                        }
                    }
                }
            }
            if (studentByAdm.isEmpty()) {
                throw new BusinessException(
                        "None of the students on this assessment have an admission number. "
                        + "Add admission numbers on the student records and try again.");
            }

            Map<String, Integer> maxBySubject = new HashMap<>();
            for (var s : subjects) {
                if (s.getMaxMarks() != null) maxBySubject.put(s.getSubjectId(), s.getMaxMarks());
            }

            Set<String> matchedAdm = new LinkedHashSet<>();
            List<String> unmatchedAdm = new ArrayList<>();
            List<String> invalidRows = new ArrayList<>();

            int last = sheet.getLastRowNum();
            for (int r = headerRowIdx + 1; r <= last; r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String admission = cellText(row.getCell(admCol)).trim();
                if (admission.isBlank()) continue;   // spacer / footer row

                OtherAssessment.StudentEntry entry = studentByAdm.get(admission);
                if (entry == null) {
                    unmatchedAdm.add(admission);
                    continue;
                }

                // Read every subject cell. Blank → null (skip); numeric
                // → clamp to [0, max] like the manual entry flow does.
                boolean rowInvalid = false;
                Map<String, Double> updates = new HashMap<>();
                for (var s : subjects) {
                    Integer col = colBySubjectId.get(s.getSubjectId());
                    if (col == null) continue;   // subject header wasn't in the sheet
                    Cell cell = row.getCell(col);
                    if (cell == null) continue;
                    Double val = readNumeric(cell);
                    if (val == null) continue;   // blank cell
                    if (val < 0) {
                        rowInvalid = true;
                        invalidRows.add("Row " + (r + 1) + ": negative marks in " + s.getSubjectName());
                        break;
                    }
                    Integer max = maxBySubject.get(s.getSubjectId());
                    if (max != null && val > max) {
                        rowInvalid = true;
                        invalidRows.add("Row " + (r + 1) + ": " + val + " exceeds max " + max
                                + " for " + s.getSubjectName());
                        break;
                    }
                    updates.put(s.getSubjectId(), val);
                }
                if (rowInvalid) continue;

                // Apply the parsed marks in place — anything not in the
                // sheet stays as it was on the doc, so partial uploads
                // work.
                if (entry.getSubjects() == null) entry.setSubjects(new ArrayList<>());
                for (var m : entry.getSubjects()) {
                    if (updates.containsKey(m.getSubjectId())) {
                        m.setMarksObtained(updates.get(m.getSubjectId()));
                    }
                }
                // If the entry was missing a row for a subject that's
                // in the doc's subject list, seed one now with the
                // uploaded value.
                Set<String> present = new java.util.HashSet<>();
                for (var m : entry.getSubjects()) present.add(m.getSubjectId());
                for (var e : updates.entrySet()) {
                    if (!present.contains(e.getKey())) {
                        entry.getSubjects().add(new OtherAssessment.SubjectMark(e.getKey(), e.getValue()));
                    }
                }

                matchedAdm.add(admission);
            }

            // Recompute ranks + persist. Delegates to the same ranking
            // helper as manual saves so both paths stay consistent.
            recomputeRanks(doc.getStudents());
            doc.setUpdatedBy(userId);
            assessmentRepository.save(doc);

            auditService.log("OTHER_ASSESSMENT_UPLOAD_MARKS", "OtherAssessment", assessmentId,
                    "Bulk upload: matched=" + matchedAdm.size()
                            + " unmatched=" + unmatchedAdm.size()
                            + " invalid=" + invalidRows.size());

            result.matched = matchedAdm.size();
            result.unmatched = unmatchedAdm;
            result.invalidRows = invalidRows;
            result.missingSubjectHeaders = missingSubjectHeaders;
            return result;
        } catch (IOException e) {
            throw new BusinessException("Failed to read uploaded workbook: " + e.getMessage());
        }
    }

    // ── Ranking (kept private here so both save-paths share the algorithm) ──

    private void recomputeRanks(List<OtherAssessment.StudentEntry> students) {
        if (students == null || students.isEmpty()) return;
        record Row(OtherAssessment.StudentEntry entry, boolean hasAny, double total) {}
        List<Row> rows = new ArrayList<>(students.size());
        for (var s : students) {
            double total = 0d;
            boolean any = false;
            if (s.getSubjects() != null) {
                for (var m : s.getSubjects()) {
                    if (m.getMarksObtained() != null) {
                        total += m.getMarksObtained();
                        any = true;
                    }
                }
            }
            s.setRank(null);
            rows.add(new Row(s, any, total));
        }
        rows.sort((a, b) -> Double.compare(b.total, a.total));
        int position = 0;
        int currentRank = 0;
        Double lastTotal = null;
        for (Row r : rows) {
            if (!r.hasAny) continue;
            position++;
            if (lastTotal == null || Double.compare(r.total, lastTotal) != 0) {
                currentRank = position;
                lastTotal = r.total;
            }
            r.entry.setRank(currentRank);
        }
    }

    // ── Sheet parsing helpers ──────────────────────────────────

    /** Read the assessmentId stamped into the workbook's custom
     *  document properties by the template service. Null when the
     *  file isn't ours or the stamp was stripped. */
    private String readStampedAssessmentId(XSSFWorkbook wb) {
        try {
            var custom = wb.getProperties().getCustomProperties()
                    .getUnderlyingProperties();
            for (var p : custom.getPropertyList()) {
                if ("nvOtherAssessmentId".equals(p.getName()) && p.isSetLpwstr()) {
                    return p.getLpwstr();
                }
            }
        } catch (Exception ignored) {
            // No properties, malformed file, older POI shape — treat
            // as "no stamp" and let the name-check fallback decide.
        }
        return null;
    }

    /** Look for the first row that has an Adm No / Admission No header
     *  in any cell. The template puts it in row 3 (0-indexed 2), but
     *  scanning first 12 rows makes us tolerant of leading title rows. */
    private int findHeaderRow(Sheet sheet) {
        int last = Math.min(sheet.getLastRowNum(), 11);
        for (int r = 0; r <= last; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String txt = normaliseHeader(cellText(row.getCell(c)));
                if (txt.equals("admno") || txt.equals("admissionno") || txt.equals("admission")) {
                    return r;
                }
            }
        }
        return -1;
    }

    private String cellText(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue() == null ? "" : cell.getStringCellValue();
            case NUMERIC: {
                double v = cell.getNumericCellValue();
                if (v == Math.floor(v) && !Double.isInfinite(v)) return Long.toString((long) v);
                return Double.toString(v);
            }
            case BOOLEAN: return Boolean.toString(cell.getBooleanCellValue());
            case FORMULA:
                try { return cell.getStringCellValue(); }
                catch (Exception ignore) { return Double.toString(cell.getNumericCellValue()); }
            default: return "";
        }
    }

    /** Blank / non-numeric → null; otherwise the numeric value. */
    private Double readNumeric(Cell cell) {
        if (cell == null) return null;
        CellType t = cell.getCellType();
        if (t == CellType.BLANK) return null;
        if (t == CellType.NUMERIC) return cell.getNumericCellValue();
        if (t == CellType.STRING) {
            String s = cell.getStringCellValue();
            if (s == null || s.trim().isEmpty()) return null;
            try { return Double.parseDouble(s.trim()); }
            catch (NumberFormatException e) { return null; }
        }
        if (t == CellType.FORMULA) {
            try { return cell.getNumericCellValue(); }
            catch (Exception e) { return null; }
        }
        return null;
    }

    /** Normalise a header cell for matching. The template writes
     *  subject headers as {@code "Hindi\n(/ 40)"} — take everything
     *  before the first newline (also handles literal " (" so we
     *  survive schools that hand-type a max-marks suffix without a
     *  line break), then lowercase and strip non-alphanumerics so
     *  "Roll No", "Roll-No", "roll_no" all collapse to "rollno". */
    private String normaliseHeader(String h) {
        if (h == null) return "";
        String base = h;
        int nl = base.indexOf('\n');
        if (nl >= 0) base = base.substring(0, nl);
        int paren = base.indexOf('(');
        if (paren >= 0) base = base.substring(0, paren);
        return base.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    /** Returns the first non-null column mapped to any of the given
     *  normalised header keys. */
    private Integer firstMatching(Map<String, Integer> colByHeader, String... keys) {
        for (String k : keys) {
            Integer col = colByHeader.get(k);
            if (col != null) return col;
        }
        return null;
    }

    // ── Result shape ─────────────────────────────────────────────

    public static class UploadResult {
        /** Number of students whose marks were updated from the sheet. */
        public int matched;
        /** Admission numbers in the sheet that didn't match any
         *  student in the assessment — shown so the admin can chase
         *  the source data or delete stray rows. */
        public List<String> unmatched = new ArrayList<>();
        /** Row-level parse errors (over-max, negative, etc.).
         *  A row that fails validation is skipped — everything else
         *  in the same upload still saves. */
        public List<String> invalidRows = new ArrayList<>();
        /** Subjects on the assessment whose header was missing from
         *  the sheet — surfaces silent format drift. */
        public List<String> missingSubjectHeaders = new ArrayList<>();
    }
}
