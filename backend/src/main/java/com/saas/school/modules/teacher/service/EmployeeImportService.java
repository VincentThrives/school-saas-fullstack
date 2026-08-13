package com.saas.school.modules.teacher.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.teacher.dto.EmployeeImportErrorReport;
import com.saas.school.modules.teacher.dto.EmployeeImportResult;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Bulk-import employees from an Excel sheet. Mirrors
 * {@code StudentImportService} — the same 2-step "download template →
 * fill → upload" flow, all-or-nothing validation, and a row-by-row
 * error report shape.
 *
 * <p>Class-subject assignments and class-teacher role are deliberately
 * NOT in the template — those are complex UI-driven picks (dependent
 * dropdowns for class → section → subject) and admin sets them per
 * employee after the import.</p>
 */
@Service
public class EmployeeImportService {
    private static final Logger log = LoggerFactory.getLogger(EmployeeImportService.class);

    // ── Header layout ────────────────────────────────────────────────
    // Column order matches parseRow() indices below. Trailing "*" marks
    // a required column; also mirrored in REQUIRED_HEADERS so the
    // template can amber-tint them.
    private static final List<String> HEADERS = List.of(
            "Employee ID *", "First Name *", "Last Name",
            "Date of Birth *", "Employee Role *", "Phone *",
            "Email", "Qualification", "Specialization", "Joining Date",
            "Address - Street", "Address - City", "Address - State", "Address - Zip"
    );

    private static final int COL_EMPLOYEE_ID   = 0;
    private static final int COL_FIRST_NAME    = 1;
    private static final int COL_LAST_NAME     = 2;
    private static final int COL_DOB           = 3;
    private static final int COL_ROLE          = 4;
    private static final int COL_PHONE         = 5;
    private static final int COL_EMAIL         = 6;
    private static final int COL_QUALIFICATION = 7;
    private static final int COL_SPECIALIZATION= 8;
    private static final int COL_JOINING_DATE  = 9;
    private static final int COL_ADDR_STREET   = 10;
    private static final int COL_ADDR_CITY     = 11;
    private static final int COL_ADDR_STATE    = 12;
    private static final int COL_ADDR_ZIP      = 13;

    private static final Set<String> REQUIRED_HEADERS = Set.of(
            "Employee ID *", "First Name *", "Date of Birth *",
            "Employee Role *", "Phone *");

    /** Kept in sync with {@link Teacher.EmployeeRole}. Listed on the
     *  Instructions sheet so admin knows the valid values without
     *  guessing. */
    private static final List<String> VALID_ROLES = List.of(
            "TEACHER", "PRINCIPAL", "COORDINATOR", "ACCOUNTANT", "CLERK",
            "HEAD_MISTRESS", "LAB_ASSISTANT", "NON_TEACHING");

    private static final Pattern EMAIL_RE = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE10_RE = Pattern.compile("^\\d{10}$");

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("MM-dd-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    @Autowired private TeacherRepository teacherRepository;
    @Autowired private EmployeeUserProvisioningService userProvisioning;

    // ── Template generation ──────────────────────────────────────────

    public byte[] buildTemplate() {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet employees = wb.createSheet("Employees");
            CellStyle headerStyle = headerStyle(wb, false);
            CellStyle requiredHeaderStyle = headerStyle(wb, true);

            Row header = employees.createRow(0);
            for (int i = 0; i < HEADERS.size(); i++) {
                Cell c = header.createCell(i);
                c.setCellValue(HEADERS.get(i));
                c.setCellStyle(REQUIRED_HEADERS.contains(HEADERS.get(i))
                        ? requiredHeaderStyle : headerStyle);
            }
            // Sample row — admin overwrites/deletes. Plain strings so
            // Excel doesn't reformat dates on save.
            String[] sample = {
                    "EMP-001", "Vincent", "Prakash",
                    "12-08-1990", "TEACHER", "9876543210",
                    "vincent@example.com", "M.Sc. Mathematics",
                    "Algebra & Calculus", "01-06-2020",
                    "5th Cross", "Bengaluru", "Karnataka", "560001"
            };
            Row sampleRow = employees.createRow(1);
            for (int i = 0; i < sample.length && i < HEADERS.size(); i++) {
                sampleRow.createCell(i).setCellValue(sample[i]);
            }
            for (int i = 0; i < HEADERS.size(); i++) employees.autoSizeColumn(i);
            employees.createFreezePane(0, 1);

            // ── In-cell dropdown for Role ──────────────────────────
            // Excel-side data validation so admins pick from the exact
            // enum values instead of guessing capitalisation. Range
            // covers rows 2..1001 (data rows; row 1 is header). Backend
            // still re-checks server-side — the dropdown is UX, not
            // security.
            addRoleDropdown(employees);

            // ── Instructions sheet ─────────────────────────────────
            Sheet info = wb.createSheet("Instructions");
            CellStyle bold = wb.createCellStyle();
            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            bold.setFont(boldFont);

            int r = 0;
            writeRow(info, r++, bold, "How to use this template", "");
            writeRow(info, r++, null,  "1.", "Fill one row per employee in the 'Employees' tab.");
            writeRow(info, r++, null,  "2.", "Columns marked * are required.");
            writeRow(info, r++, null,  "3.", "Delete the sample row before uploading.");
            writeRow(info, r++, null,  "4.", "If any row has a problem the whole file is rejected — nothing is saved until every row is clean.");
            writeRow(info, r++, null,  "5.", "After import, open each employee to assign their classes and subjects (not part of this template).");
            r++;
            writeRow(info, r++, bold,  "Column", "Notes");
            writeRow(info, r++, null,  "Employee ID", "Unique identifier — becomes the login username. Duplicates across the file or against existing employees are rejected.");
            writeRow(info, r++, null,  "Date of Birth", "Accepted formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD. Used to build the default password (FirstName@BirthYear).");
            writeRow(info, r++, null,  "Employee Role", "One of: " + String.join(", ", VALID_ROLES) + " (case-insensitive).");
            writeRow(info, r++, null,  "Phone", "Exactly 10 digits (spaces, dashes, +91 prefix are stripped automatically).");
            writeRow(info, r++, null,  "Email", "Optional. If present, must look like name@domain.tld. Stored lowercase.");
            writeRow(info, r++, null,  "Joining Date", "Optional. Same date formats as DOB.");
            r++;
            writeRow(info, r++, bold,  "Default login credentials", "");
            writeRow(info, r++, null,  "Username", "The Employee ID you enter above.");
            writeRow(info, r++, null,  "Password", "FirstName + \"@\" + BirthYear (e.g. Vincent@1990).");
            writeRow(info, r++, null,  "Employees can change this after first login.", "");
            info.autoSizeColumn(0);
            info.autoSizeColumn(1);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Failed to build employee import template: " + e.getMessage());
        }
    }

    private CellStyle headerStyle(XSSFWorkbook wb, boolean required) {
        XSSFCellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        // Amber for required, slate for optional — matches Students template
        // so the two feel like the same product surface.
        style.setFillForegroundColor(new XSSFColor(
                required ? new Color(180, 83, 9) : new Color(51, 65, 85), null));
        return style;
    }

    private void writeRow(Sheet sheet, int rowIdx, CellStyle style, String col1, String col2) {
        Row row = sheet.createRow(rowIdx);
        Cell a = row.createCell(0); a.setCellValue(col1);
        Cell b = row.createCell(1); b.setCellValue(col2);
        if (style != null) { a.setCellStyle(style); b.setCellStyle(style); }
    }

    /** Attach an in-cell list dropdown to the Role column across rows
     *  2..1001, populated from {@link #VALID_ROLES}. The error box is
     *  informational only (STOP style would block cell edits mid-typing
     *  which admins find annoying — WARNING lets them commit but flags
     *  the mismatch; backend validation is the real gate). */
    private void addRoleDropdown(Sheet sheet) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(
                VALID_ROLES.toArray(new String[0]));
        CellRangeAddressList addresses = new CellRangeAddressList(
                1, 1000, COL_ROLE, COL_ROLE);
        DataValidation validation = helper.createValidation(constraint, addresses);
        validation.setErrorStyle(DataValidation.ErrorStyle.WARNING);
        validation.setShowErrorBox(true);
        validation.createErrorBox("Invalid role",
                "Pick one of: " + String.join(", ", VALID_ROLES));
        // Explicitly leave the dropdown arrow visible — it's the whole point.
        validation.setSuppressDropDownArrow(false);
        sheet.addValidationData(validation);
    }

    // ── Import ───────────────────────────────────────────────────────

    /**
     * Parse the uploaded workbook, validate every row, and either
     * commit them all or reject the file with a row-by-row report.
     *
     * @throws BusinessException wrapping the {@link EmployeeImportErrorReport}
     *         when validation fails; the controller unwraps it into a 400
     *         with the report as {@code data}.
     */
    public EmployeeImportResult importFromExcel(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Please pick a .xlsx file to upload.");
        }
        EmployeeImportErrorReport report = new EmployeeImportErrorReport();
        List<Teacher> parsed = new ArrayList<>();
        // Track admin's-typed-in-file dupes so we don't wait for the
        // DB write to blow up on the second occurrence.
        Set<String> seenEmployeeIds = new HashSet<>();

        try (InputStream is = file.getInputStream(); Workbook wb = WorkbookFactory.create(is)) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet == null || sheet.getLastRowNum() < 1) {
                throw new BusinessException("The sheet is empty — add at least one employee row.");
            }
            // Header row check — fail fast if columns are missing or
            // out of order rather than silently importing garbage.
            Row header = sheet.getRow(0);
            for (int i = 0; i < HEADERS.size(); i++) {
                String expected = HEADERS.get(i);
                String actual = header == null ? "" : cellString(header.getCell(i));
                if (!expected.equalsIgnoreCase(actual)) {
                    throw new BusinessException(
                        "Template header mismatch — expected '" + expected +
                        "' in column " + (i + 1) + ", got '" + actual +
                        "'. Please re-download the template.");
                }
            }

            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (isBlankRow(row)) continue; // trailing empty rows tolerated
                int excelRow = rowIdx + 1; // 1-based, matches Excel's UI

                Teacher t = parseRow(row, excelRow, report, seenEmployeeIds);
                if (t != null) parsed.add(t);
            }
        } catch (IOException e) {
            throw new BusinessException("Could not read the uploaded file — is it a .xlsx? " + e.getMessage());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Unexpected error reading the file: " + e.getMessage());
        }

        // Cross-check against existing employees BEFORE any write, so
        // rows already-in-DB show up in the same error report as
        // in-file dupes rather than as a partial import.
        for (Teacher t : parsed) {
            if (teacherRepository.existsByEmployeeIdAndDeletedAtIsNull(t.getEmployeeId())) {
                report.add(rowNumOf(parsed, t), "Employee ID *",
                    "Employee ID '" + t.getEmployeeId() + "' already exists in the system.");
            }
        }

        if (!report.isEmpty()) {
            // All-or-nothing — mirrors StudentImportService. GlobalExceptionHandler
            // maps this to a 400 whose body carries the row-by-row report so the
            // frontend can render a fix-it list.
            throw new ImportValidationException(report);
        }

        // All clean — write to DB. Failures here are unexpected (validation
        // already ran) but we still tolerate individual-row failures so a
        // freak Mongo hiccup on one row doesn't lose the other 49.
        int created = 0, skipped = 0;
        for (Teacher t : parsed) {
            try {
                t.setTeacherId(UUID.randomUUID().toString());
                if (t.getEmployeeRole() == null || t.getEmployeeRole().isBlank()) {
                    t.setEmployeeRole("TEACHER");
                }
                String userId = userProvisioning.provision(t);
                if (userId != null) t.setUserId(userId);
                teacherRepository.save(t);
                created++;
            } catch (Exception e) {
                log.error("Failed to persist imported employee {}: {}",
                    t.getEmployeeId(), e.getMessage(), e);
                skipped++;
            }
        }
        log.info("Employee bulk-import: created={}, skipped={}", created, skipped);
        return new EmployeeImportResult(created, skipped);
    }

    // ── Parsing ──────────────────────────────────────────────────────

    private Teacher parseRow(Row row, int excelRow,
                             EmployeeImportErrorReport report,
                             Set<String> seenEmployeeIds) {
        boolean rowHasErrors = false;

        String employeeId = cellString(row.getCell(COL_EMPLOYEE_ID)).trim();
        String firstName  = cellString(row.getCell(COL_FIRST_NAME)).trim();
        String lastName   = cellString(row.getCell(COL_LAST_NAME)).trim();
        String dobRaw     = cellString(row.getCell(COL_DOB)).trim();
        String roleRaw    = cellString(row.getCell(COL_ROLE)).trim();
        String phoneRaw   = cellString(row.getCell(COL_PHONE)).trim();
        String emailRaw   = cellString(row.getCell(COL_EMAIL)).trim();
        String qualif     = cellString(row.getCell(COL_QUALIFICATION)).trim();
        String special    = cellString(row.getCell(COL_SPECIALIZATION)).trim();
        String joinRaw    = cellString(row.getCell(COL_JOINING_DATE)).trim();
        String street     = cellString(row.getCell(COL_ADDR_STREET)).trim();
        String city       = cellString(row.getCell(COL_ADDR_CITY)).trim();
        String state      = cellString(row.getCell(COL_ADDR_STATE)).trim();
        String zip        = cellString(row.getCell(COL_ADDR_ZIP)).trim();

        // ── Required fields ─────────────────────────────────────
        if (employeeId.isEmpty()) {
            report.add(excelRow, "Employee ID *", "Employee ID is required."); rowHasErrors = true;
        } else if (!seenEmployeeIds.add(employeeId)) {
            report.add(excelRow, "Employee ID *",
                "Employee ID '" + employeeId + "' is duplicated within this file.");
            rowHasErrors = true;
        }
        if (firstName.isEmpty()) {
            report.add(excelRow, "First Name *", "First Name is required."); rowHasErrors = true;
        }
        LocalDate dob = null;
        if (dobRaw.isEmpty()) {
            report.add(excelRow, "Date of Birth *",
                "Date of Birth is required (used to build the default password)."); rowHasErrors = true;
        } else {
            dob = parseDate(row.getCell(COL_DOB), dobRaw);
            if (dob == null) {
                report.add(excelRow, "Date of Birth *",
                    "Could not read '" + dobRaw + "' as a date. Try DD-MM-YYYY or YYYY-MM-DD.");
                rowHasErrors = true;
            }
        }
        String normalizedRole = roleRaw.toUpperCase();
        if (roleRaw.isEmpty()) {
            report.add(excelRow, "Employee Role *", "Employee Role is required."); rowHasErrors = true;
        } else if (!VALID_ROLES.contains(normalizedRole)) {
            report.add(excelRow, "Employee Role *",
                "Role '" + roleRaw + "' is not valid. Use one of: " + String.join(", ", VALID_ROLES));
            rowHasErrors = true;
        }
        String phone = stripPhoneNoise(phoneRaw);
        if (phoneRaw.isEmpty()) {
            report.add(excelRow, "Phone *", "Phone is required."); rowHasErrors = true;
        } else if (!PHONE10_RE.matcher(phone).matches()) {
            report.add(excelRow, "Phone *",
                "Phone must be exactly 10 digits. Got '" + phoneRaw + "' → '" + phone + "'.");
            rowHasErrors = true;
        }

        // ── Optional fields ─────────────────────────────────────
        String email = emailRaw.isEmpty() ? null : emailRaw.toLowerCase();
        if (email != null && !EMAIL_RE.matcher(email).matches()) {
            report.add(excelRow, "Email",
                "Email '" + emailRaw + "' doesn't look valid. Leave blank or use name@domain.tld.");
            rowHasErrors = true;
        }
        LocalDate joiningDate = null;
        if (!joinRaw.isEmpty()) {
            joiningDate = parseDate(row.getCell(COL_JOINING_DATE), joinRaw);
            if (joiningDate == null) {
                report.add(excelRow, "Joining Date",
                    "Could not read '" + joinRaw + "' as a date. Leave blank or use DD-MM-YYYY.");
                rowHasErrors = true;
            }
        }

        if (rowHasErrors) return null;

        Teacher t = new Teacher();
        t.setEmployeeId(employeeId);
        t.setFirstName(firstName);
        if (!lastName.isEmpty()) t.setLastName(lastName);
        t.setDateOfBirth(dob);
        t.setEmployeeRole(normalizedRole);
        t.setPhone(phone);
        if (email != null) t.setEmail(email);
        if (!qualif.isEmpty()) t.setQualification(qualif);
        if (!special.isEmpty()) t.setSpecialization(special);
        if (joiningDate != null) t.setJoiningDate(joiningDate);
        if (!street.isEmpty() || !city.isEmpty() || !state.isEmpty() || !zip.isEmpty()) {
            Teacher.Address addr = new Teacher.Address();
            if (!street.isEmpty()) addr.setStreet(street);
            if (!city.isEmpty()) addr.setCity(city);
            if (!state.isEmpty()) addr.setState(state);
            if (!zip.isEmpty()) addr.setZip(zip);
            t.setAddress(addr);
        }
        return t;
    }

    // ── Cell helpers ─────────────────────────────────────────────────

    private String cellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().toLocalDate().toString()
                    : trimTrailingZero(cell.getNumericCellValue());
            case BOOLEAN -> Boolean.toString(cell.getBooleanCellValue());
            case FORMULA -> {
                try { yield cell.getStringCellValue(); }
                catch (Exception e) { yield trimTrailingZero(cell.getNumericCellValue()); }
            }
            default -> "";
        };
    }

    /** "9876543210.0" from Excel → "9876543210". Leaves non-integers alone. */
    private String trimTrailingZero(double value) {
        if (value == Math.floor(value)) {
            return String.valueOf((long) value);
        }
        return String.valueOf(value);
    }

    /** Accept dates as either Excel-native date cells (deserialised
     *  automatically) or as text in one of the common Indian/ISO formats. */
    private LocalDate parseDate(Cell cell, String raw) {
        if (cell != null && cell.getCellType() == CellType.NUMERIC
                && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant()
                    .atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        }
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(raw, fmt); }
            catch (Exception ignored) {}
        }
        return null;
    }

    /** "+91 98765-43210" → "9876543210". Anything non-digit is dropped;
     *  a leading "91" that leaves 12 digits gets trimmed. */
    private String stripPhoneNoise(String raw) {
        if (raw == null) return "";
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) return digits.substring(2);
        return digits;
    }

    private boolean isBlankRow(Row row) {
        if (row == null) return true;
        for (int i = 0; i < HEADERS.size(); i++) {
            if (!cellString(row.getCell(i)).trim().isEmpty()) return false;
        }
        return true;
    }

    /** Lookup helper for the DB-cross-check pass — hands back the
     *  Excel row number the errored employee was parsed from so the
     *  error report matches what the admin sees on-screen. Falls back
     *  to 0 when the ordering can't be reconstructed. */
    private int rowNumOf(List<Teacher> parsed, Teacher target) {
        int idx = parsed.indexOf(target);
        // +2 because header = row 1 and the parsed list is 0-based.
        return idx < 0 ? 0 : idx + 2;
    }

    /**
     * Thrown when an import fails validation — carries the full row-by-row
     * report so the controller can return it as a 400 response body. Not a
     * BusinessException because the body shape is structured, not a string.
     * Handled by {@code GlobalExceptionHandler}.
     */
    public static class ImportValidationException extends RuntimeException {
        private final EmployeeImportErrorReport report;
        public ImportValidationException(EmployeeImportErrorReport report) {
            super("Employee import validation failed: " + report.getErrors().size() + " row(s) have errors");
            this.report = report;
        }
        public EmployeeImportErrorReport getReport() { return report; }
    }
}
