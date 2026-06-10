package com.saas.school.modules.student.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.dto.CreateStudentRequest;
import com.saas.school.modules.student.dto.StudentImportErrorReport;
import com.saas.school.modules.student.dto.StudentImportResult;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
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
 * Bulk-import students from an Excel sheet.
 *
 * <ol>
 *   <li>{@link #buildTemplate} — generate a .xlsx with the right header row
 *       and an Instructions sheet. Admin downloads, fills, re-uploads.</li>
 *   <li>{@link #importFromExcel} — parse the upload, validate every row,
 *       and either save them all or reject the whole file with a
 *       row-by-row error report. All-or-nothing so the DB never gets a
 *       partial batch.</li>
 * </ol>
 *
 * <p>Class names and section names are resolved case-insensitively against
 * the currently picked academic year. Admission numbers must be unique
 * within the file AND against the DB.
 */
@Service
public class StudentImportService {
    private static final Logger log = LoggerFactory.getLogger(StudentImportService.class);

    // ── Column headers. Order matches the on-screen plan; keep in sync with
    //    parseRow() below. Trailing "*" marks a required column.
    private static final List<String> HEADERS = List.of(
            "First Name *", "Last Name *", "Date of Birth *", "Gender *",
            "Class *", "Section *", "Admission Number *", "Roll Number",
            "Student Phone", "Student Email", "Parent Name", "Parent Phone *",
            "Parent Email", "Blood Group",
            "Address - Street", "Address - City", "Address - State", "Address - Zip"
    );

    // Indices into the header list — referenced from parseRow.
    private static final int COL_FIRST_NAME      = 0;
    private static final int COL_LAST_NAME       = 1;
    private static final int COL_DOB             = 2;
    private static final int COL_GENDER          = 3;
    private static final int COL_CLASS           = 4;
    private static final int COL_SECTION         = 5;
    private static final int COL_ADM_NUM         = 6;
    private static final int COL_ROLL_NUM        = 7;
    private static final int COL_STUDENT_PHONE   = 8;
    private static final int COL_STUDENT_EMAIL   = 9;
    private static final int COL_PARENT_NAME     = 10;
    private static final int COL_PARENT_PHONE    = 11;
    private static final int COL_PARENT_EMAIL    = 12;
    private static final int COL_BLOOD_GROUP     = 13;
    private static final int COL_ADDR_STREET     = 14;
    private static final int COL_ADDR_CITY       = 15;
    private static final int COL_ADDR_STATE      = 16;
    private static final int COL_ADDR_ZIP        = 17;

    private static final Set<String> REQUIRED_HEADERS = Set.of(
            "First Name *", "Last Name *", "Date of Birth *", "Gender *",
            "Class *", "Section *", "Admission Number *", "Parent Phone *");

    private static final Set<String> VALID_BLOOD_GROUPS = Set.of(
            "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-");

    private static final Pattern EMAIL_RE = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE10_RE = Pattern.compile("^\\d{10}$");
    private static final Pattern AADHAAR_RE = Pattern.compile("^\\d{12}$");

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("MM-dd-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    @Autowired private StudentService studentService;
    @Autowired private StudentRepository studentRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private AcademicYearRepository academicYearRepository;
    @Autowired private AuditService auditService;

    // ── Template generation ──────────────────────────────────────────────

    /**
     * Build the .xlsx template returned by the Download Template button.
     * Header row is frozen + bold; required columns get an amber tint so
     * they're impossible to miss. Sheet 2 explains each column in plain
     * language plus lists the classes/sections currently configured so
     * admin knows the valid values up front.
     */
    public byte[] buildTemplate(String academicYearId) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            // ── Sheet 1: Students ──
            Sheet students = wb.createSheet("Students");
            CellStyle headerStyle = headerStyle(wb, false);
            CellStyle requiredHeaderStyle = headerStyle(wb, true);

            Row header = students.createRow(0);
            for (int i = 0; i < HEADERS.size(); i++) {
                Cell c = header.createCell(i);
                c.setCellValue(HEADERS.get(i));
                c.setCellStyle(REQUIRED_HEADERS.contains(HEADERS.get(i))
                        ? requiredHeaderStyle : headerStyle);
            }
            // Sample row 2 — admin replaces it. Plain string cells so the
            // values render exactly as typed.
            String[] sample = {
                    "Vincent", "Prakash", "12-08-2015", "MALE",
                    "1st", "A", "ADM-001", "1",
                    "9876543210", "vincent@example.com", "Suresh Kumar", "9876543211",
                    "suresh@example.com", "O+",
                    "5th Cross", "Bengaluru", "Karnataka", "560001"
            };
            Row sampleRow = students.createRow(1);
            for (int i = 0; i < sample.length && i < HEADERS.size(); i++) {
                sampleRow.createCell(i).setCellValue(sample[i]);
            }
            for (int i = 0; i < HEADERS.size(); i++) {
                students.autoSizeColumn(i);
            }
            students.createFreezePane(0, 1);

            // ── Excel-level duplicate guard for Admission Number + Roll Number ──
            //
            // Adds in-cell data validation that flags the row red the moment
            // the admin types a duplicate, well before they upload. Backend
            // still re-checks server-side (defence in depth) but this catches
            // mistakes during data entry.
            //
            // Range covers rows 2..1001 (data rows; row 1 is header). Anyone
            // importing 1000+ students at once can re-download or extend the
            // template — that's already past the size-sweet-spot of one Excel
            // sheet anyway.
            addUniqueColumnValidation(
                    students, COL_ADM_NUM,
                    "Admission Number must be unique",
                    "This admission number is already used in another row of this file. "
                            + "Each student needs a unique admission number.");
            addUniqueColumnValidation(
                    students, COL_ROLL_NUM,
                    "Roll Number must be unique",
                    "This roll number is already used in another row. "
                            + "Each student in the same upload needs a unique roll number.");

            // ── Sheet 2: Instructions ──
            Sheet info = wb.createSheet("Instructions");
            CellStyle bold = wb.createCellStyle();
            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            bold.setFont(boldFont);

            int r = 0;
            writeRow(info, r++, bold, "How to use this template", "");
            writeRow(info, r++, null,  "1.", "Fill one row per student in the 'Students' tab.");
            writeRow(info, r++, null,  "2.", "Columns marked * are required.");
            writeRow(info, r++, null,  "3.", "Delete the sample row before uploading.");
            writeRow(info, r++, null,  "4.", "If any row has a problem the whole file is rejected — nothing is saved until every row is clean.");
            r++;
            writeRow(info, r++, bold,  "Column", "Notes");
            writeRow(info, r++, null,  "Date of Birth", "Accepted formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD. Excel date cells also work.");
            writeRow(info, r++, null,  "Gender", "MALE, FEMALE or OTHER (case-insensitive).");
            writeRow(info, r++, null,  "Class", "Exact class name as it appears in the system (case-insensitive).");
            writeRow(info, r++, null,  "Section", "Section name within that class (case-insensitive — stored UPPERCASE).");
            writeRow(info, r++, null,  "Admission Number", "Must be unique. Duplicates across this file or against existing students are rejected. Excel will warn you if you type a duplicate.");
            writeRow(info, r++, null,  "Roll Number", "Must be unique within this upload. Excel will warn you if you repeat a value.");
            writeRow(info, r++, null,  "Parent Phone", "Exactly 10 digits (spaces, dashes, +91 prefix are stripped automatically).");
            writeRow(info, r++, null,  "Email", "Optional. If present, must look like name@domain.tld. Stored lowercase.");
            writeRow(info, r++, null,  "Blood Group", "One of: A+, A-, B+, B-, O+, O-, AB+, AB-.");
            r++;

            // List configured classes + sections so admin doesn't have to flip tabs.
            writeRow(info, r++, bold,  "Configured Classes & Sections (current academic year)", "");
            List<SchoolClass> classes = (academicYearId != null && !academicYearId.isBlank())
                    ? schoolClassRepository.findByAcademicYearId(academicYearId)
                    : Collections.emptyList();
            if (classes.isEmpty()) {
                writeRow(info, r++, null, "(none configured for the picked year)", "");
            } else {
                writeRow(info, r++, bold, "Class", "Sections");
                for (SchoolClass cls : classes) {
                    String sections = (cls.getSections() == null)
                            ? "" : cls.getSections().stream()
                                .map(SchoolClass.Section::getName)
                                .filter(Objects::nonNull)
                                .reduce((a, b) -> a + ", " + b).orElse("");
                    writeRow(info, r++, null, cls.getName(), sections);
                }
            }
            info.autoSizeColumn(0);
            info.autoSizeColumn(1);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException("Failed to build import template: " + e.getMessage());
        }
    }

    private CellStyle headerStyle(XSSFWorkbook wb, boolean required) {
        XSSFCellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        if (required) {
            // Amber for required headers — clearly differentiated from blue optional ones.
            style.setFillForegroundColor(new XSSFColor(new Color(217, 119, 6), null));
        } else {
            style.setFillForegroundColor(new XSSFColor(new Color(55, 65, 81), null));
        }
        return style;
    }

    private void writeRow(Sheet sheet, int rowIdx, CellStyle style, String a, String b) {
        Row row = sheet.createRow(rowIdx);
        Cell c0 = row.createCell(0);
        c0.setCellValue(a == null ? "" : a);
        if (style != null) c0.setCellStyle(style);
        Cell c1 = row.createCell(1);
        c1.setCellValue(b == null ? "" : b);
        if (style != null) c1.setCellStyle(style);
    }

    /**
     * Attach an Excel-native uniqueness validator to the given column.
     *
     * <p>Uses a custom formula <code>COUNTIF($X$2:$X$1001, X2) &le; 1</code>
     * which evaluates per-cell — Excel marks the cell with an error popup
     * the moment the value would create a second occurrence in the column.
     * Empty cells pass (COUNTIF of "" against the range will count every
     * other empty cell, so we explicitly allow empties by OR-ing
     * <code>X2=""</code>).
     *
     * @param sheet      the Students sheet
     * @param colIndex   0-based column number (matches COL_* constants)
     * @param errorTitle short title shown in the Excel error popup
     * @param errorBody  body text shown in the Excel error popup
     */
    private void addUniqueColumnValidation(Sheet sheet, int colIndex,
                                            String errorTitle, String errorBody) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        // Excel uses 1-based column letters; convert from our 0-based index.
        String colLetter = org.apache.poi.ss.util.CellReference
                .convertNumToColString(colIndex);
        String range = "$" + colLetter + "$2:$" + colLetter + "$1001";
        String cellRef = colLetter + "2";
        // Allow empties (so Roll Number column doesn't trip on the many
        // blank rows admins might leave). The COUNTIF wins for non-blank
        // values: only the first occurrence counts as 1, every later
        // duplicate counts >= 2 and gets flagged.
        String formula = "OR(" + cellRef + "=\"\", COUNTIF(" + range + "," + cellRef + ")=1)";

        DataValidationConstraint constraint = helper.createCustomConstraint(formula);
        CellRangeAddressList addresses = new CellRangeAddressList(
                1, 1000, colIndex, colIndex);
        DataValidation validation = helper.createValidation(constraint, addresses);
        validation.setErrorStyle(DataValidation.ErrorStyle.STOP);
        validation.setShowErrorBox(true);
        validation.createErrorBox(errorTitle, errorBody);
        // suppressDropDownArrow has no effect for custom constraints, but
        // explicitly turning it on is harmless and consistent with intent.
        validation.setSuppressDropDownArrow(true);
        sheet.addValidationData(validation);
    }

    // ── Import / parse ───────────────────────────────────────────────────

    /**
     * Parse the uploaded .xlsx, validate every row, and either save them all
     * or reject the whole file. The academic year ID passed in is the year
     * the admin is currently viewing on the Students page — all imported
     * students join that year's active record.
     */
    public StudentImportResult importFromExcel(MultipartFile file, String academicYearId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("No file uploaded.");
        }
        if (academicYearId == null || academicYearId.isBlank()) {
            throw new BusinessException("Academic year is required to import students.");
        }
        AcademicYear year = academicYearRepository.findById(academicYearId)
                .orElseThrow(() -> new BusinessException("Academic year not found."));

        // Build name → SchoolClass index (case-insensitive) for the chosen year.
        List<SchoolClass> classesInYear = schoolClassRepository.findByAcademicYearId(academicYearId);
        Map<String, SchoolClass> classByLowerName = new HashMap<>();
        for (SchoolClass cls : classesInYear) {
            if (cls.getName() != null) {
                classByLowerName.put(cls.getName().trim().toLowerCase(Locale.ROOT), cls);
            }
        }

        StudentImportErrorReport report = new StudentImportErrorReport();
        List<CreateStudentRequest> toCreate = new ArrayList<>();
        Set<String> admissionsInFile = new HashSet<>();
        Set<String> rollNumbersInFile = new HashSet<>();

        try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet == null) {
                throw new BusinessException("Uploaded file has no sheets.");
            }
            // Header validation — make sure the file came from our template.
            Row header = sheet.getRow(0);
            if (header == null) {
                throw new BusinessException("First row must contain headers.");
            }
            for (int i = 0; i < HEADERS.size(); i++) {
                String expected = HEADERS.get(i);
                String actual = cellString(header.getCell(i));
                if (actual == null || !actual.trim().equalsIgnoreCase(expected)) {
                    throw new BusinessException(
                            "Header in column " + (i + 1) + " must be '" + expected
                            + "' but found '" + (actual == null ? "" : actual) + "'. "
                            + "Re-download the template to get the correct columns.");
                }
            }

            int totalRows = 0;
            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null) continue;
                if (isEmptyRow(row)) continue;
                totalRows++;

                int rowNumber = rowIdx + 1; // 1-indexed for human-readable errors
                StudentImportErrorReport.RowError rowError = new StudentImportErrorReport.RowError(rowNumber);
                CreateStudentRequest req = parseRow(row, rowError, classByLowerName,
                        admissionsInFile, rollNumbersInFile, year);
                if (rowError.getErrors().isEmpty() && req != null) {
                    toCreate.add(req);
                    admissionsInFile.add(req.getAdmissionNumber());
                    if (req.getRollNumber() != null && !req.getRollNumber().isBlank()) {
                        rollNumbersInFile.add(req.getRollNumber());
                    }
                } else {
                    report.getErrors().add(rowError);
                }
            }
            report.setTotalRows(totalRows);
            report.setValidRows(toCreate.size());
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.error("Excel parse failed: {}", e.getMessage(), e);
            throw new BusinessException("Could not read the Excel file: " + e.getMessage());
        }

        if (report.getTotalRows() == 0) {
            throw new BusinessException("No student rows found in the file.");
        }
        if (report.hasAnyErrors()) {
            // All-or-nothing — DB stays untouched.
            throw new ImportValidationException(report);
        }

        // All rows valid → persist via the regular createStudent path so user
        // accounts get auto-generated identically to the manual flow.
        List<String> studentIds = new ArrayList<>();
        for (CreateStudentRequest req : toCreate) {
            try {
                var dto = studentService.createStudent(req);
                studentIds.add(dto.getStudentId());
            } catch (Exception e) {
                // A persist-time failure mid-batch is the worst case; report
                // it but stop so we don't keep creating downstream when one
                // failed (likely DB / SMS dispatch issue, not row data).
                log.error("Bulk import save failed for admission {}: {}",
                        req.getAdmissionNumber(), e.getMessage(), e);
                throw new BusinessException(
                        "Saved " + studentIds.size() + " of " + toCreate.size()
                        + " before failing on admission '" + req.getAdmissionNumber()
                        + "': " + e.getMessage());
            }
        }
        auditService.log("BULK_IMPORT_STUDENTS", "Student", academicYearId,
                "Imported " + studentIds.size() + " students from Excel");
        return new StudentImportResult(report.getTotalRows(), studentIds.size(), studentIds);
    }

    /**
     * Parse one row into a {@link CreateStudentRequest}. All field-level
     * errors are recorded on {@code rowError} — we don't short-circuit on
     * the first issue so the admin sees every problem in one pass.
     *
     * <p>Returns null only if the row is so broken (no admission number)
     * that downstream save would be meaningless; otherwise returns a
     * (potentially partly-incomplete) request — the caller decides
     * whether to keep it based on rowError.
     */
    private CreateStudentRequest parseRow(
            Row row,
            StudentImportErrorReport.RowError rowError,
            Map<String, SchoolClass> classByLowerName,
            Set<String> admissionsInFile,
            Set<String> rollNumbersInFile,
            AcademicYear year) {
        CreateStudentRequest req = new CreateStudentRequest();

        String firstName = cellString(row.getCell(COL_FIRST_NAME));
        if (firstName == null) rowError.add("First Name", "Required.");
        req.setFirstName(firstName);

        String lastName = cellString(row.getCell(COL_LAST_NAME));
        if (lastName == null) rowError.add("Last Name", "Required.");
        req.setLastName(lastName);

        LocalDate dob = cellDate(row.getCell(COL_DOB));
        if (dob == null) {
            rowError.add("Date of Birth", "Required (use DD-MM-YYYY).");
        } else if (!dob.isBefore(LocalDate.now())) {
            rowError.add("Date of Birth", "Must be before today.");
        } else if (dob.getYear() < LocalDate.now().getYear() - 30) {
            rowError.add("Date of Birth", "Year looks too old — please check.");
        }
        req.setDateOfBirth(dob);

        String genderStr = cellString(row.getCell(COL_GENDER));
        if (genderStr == null) {
            rowError.add("Gender", "Required (MALE / FEMALE / OTHER).");
        } else {
            try {
                req.setGender(Student.Gender.valueOf(genderStr.trim().toUpperCase(Locale.ROOT)));
            } catch (Exception e) {
                rowError.add("Gender", "Must be MALE, FEMALE or OTHER.");
            }
        }

        String className = cellString(row.getCell(COL_CLASS));
        String sectionName = cellString(row.getCell(COL_SECTION));
        if (className == null) rowError.add("Class", "Required.");
        if (sectionName == null) rowError.add("Section", "Required.");
        if (className != null && sectionName != null) {
            SchoolClass cls = classByLowerName.get(className.trim().toLowerCase(Locale.ROOT));
            if (cls == null) {
                rowError.add("Class", "Class '" + className
                        + "' not found in " + year.getLabel() + ".");
            } else {
                String sectionUpper = sectionName.trim().toUpperCase(Locale.ROOT);
                SchoolClass.Section sec = null;
                if (cls.getSections() != null) {
                    for (SchoolClass.Section s : cls.getSections()) {
                        if (s.getName() != null
                                && s.getName().trim().equalsIgnoreCase(sectionUpper)) {
                            sec = s;
                            break;
                        }
                    }
                }
                if (sec == null) {
                    rowError.add("Section", "Section '" + sectionName
                            + "' not found in class '" + cls.getName() + "'.");
                } else {
                    req.setClassId(cls.getClassId());
                    req.setSectionId(sec.getSectionId());
                    req.setAcademicYearId(year.getAcademicYearId());
                    req.setSubjectIds(sec.getSubjectIds());
                }
            }
        }

        String adm = cellString(row.getCell(COL_ADM_NUM));
        if (adm == null) {
            rowError.add("Admission Number", "Required.");
        } else if (admissionsInFile.contains(adm)) {
            rowError.add("Admission Number", "Duplicate within this file.");
        } else if (studentRepository.findByAdmissionNumberAndDeletedAtIsNull(adm).isPresent()) {
            rowError.add("Admission Number", "Already exists for another student.");
        }
        req.setAdmissionNumber(adm);

        String rollNum = cellString(row.getCell(COL_ROLL_NUM));
        if (rollNum != null) {
            // Roll-number uniqueness mirrors the Excel template's in-cell
            // validator: each upload's roll numbers must be distinct. We
            // don't check against the DB here — admin can legitimately
            // re-use roll numbers across academic years / classes — only
            // within THIS file.
            if (rollNumbersInFile.contains(rollNum)) {
                rowError.add("Roll Number", "Duplicate within this file.");
            }
            req.setRollNumber(rollNum);
        }

        String studentPhone = cellString(row.getCell(COL_STUDENT_PHONE));
        if (studentPhone != null) {
            String digits = StudentFieldNormalizer.phoneDigits(studentPhone);
            if (digits != null && !PHONE10_RE.matcher(digits).matches()) {
                rowError.add("Student Phone", "Must be 10 digits.");
            }
            req.setPhone(studentPhone);
        }

        String studentEmail = cellString(row.getCell(COL_STUDENT_EMAIL));
        if (studentEmail != null) {
            if (!EMAIL_RE.matcher(studentEmail.trim()).matches()) {
                rowError.add("Student Email", "Not a valid email.");
            }
            req.setEmail(studentEmail);
        }

        req.setParentName(cellString(row.getCell(COL_PARENT_NAME)));

        String parentPhone = cellString(row.getCell(COL_PARENT_PHONE));
        if (parentPhone == null) {
            rowError.add("Parent Phone", "Required (10 digits).");
        } else {
            String digits = StudentFieldNormalizer.phoneDigits(parentPhone);
            if (digits == null || !PHONE10_RE.matcher(digits).matches()) {
                rowError.add("Parent Phone", "Must be 10 digits.");
            }
            req.setParentPhone(parentPhone);
        }

        String parentEmail = cellString(row.getCell(COL_PARENT_EMAIL));
        if (parentEmail != null) {
            if (!EMAIL_RE.matcher(parentEmail.trim()).matches()) {
                rowError.add("Parent Email", "Not a valid email.");
            }
            req.setParentEmail(parentEmail);
        }

        String blood = cellString(row.getCell(COL_BLOOD_GROUP));
        if (blood != null) {
            String upper = blood.trim().toUpperCase(Locale.ROOT);
            if (!VALID_BLOOD_GROUPS.contains(upper)) {
                rowError.add("Blood Group",
                        "Must be one of A+, A-, B+, B-, O+, O-, AB+, AB-.");
            } else {
                req.setBloodGroup(upper);
            }
        }

        // Address — break into 4 cells; build the AddressDto if any are set.
        String street = cellString(row.getCell(COL_ADDR_STREET));
        String city = cellString(row.getCell(COL_ADDR_CITY));
        String state = cellString(row.getCell(COL_ADDR_STATE));
        String zip = cellString(row.getCell(COL_ADDR_ZIP));
        if (street != null || city != null || state != null || zip != null) {
            CreateStudentRequest.AddressDto address = new CreateStudentRequest.AddressDto();
            address.setStreet(street);
            address.setCity(city);
            address.setState(state);
            address.setZip(zip);
            req.setAddress(address);
        }
        return req;
    }

    // ── Cell helpers ─────────────────────────────────────────────────────

    private String cellString(Cell cell) {
        if (cell == null) return null;
        try {
            switch (cell.getCellType()) {
                case STRING:
                    return StudentFieldNormalizer.trimToNull(cell.getStringCellValue());
                case NUMERIC:
                    if (DateUtil.isCellDateFormatted(cell)) {
                        LocalDate d = cell.getLocalDateTimeCellValue().toLocalDate();
                        return d.format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
                    }
                    // Strip trailing ".0" for whole-number cells so "1.0"
                    // doesn't bleed into roll-number / phone fields.
                    double n = cell.getNumericCellValue();
                    if (n == Math.floor(n) && !Double.isInfinite(n)) {
                        return String.valueOf((long) n);
                    }
                    return String.valueOf(n);
                case BOOLEAN:
                    return String.valueOf(cell.getBooleanCellValue());
                case FORMULA:
                    return cell.getRichStringCellValue() != null
                            ? StudentFieldNormalizer.trimToNull(cell.getStringCellValue())
                            : null;
                default:
                    return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate cellDate(Cell cell) {
        if (cell == null) return null;
        try {
            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                return cell.getLocalDateTimeCellValue().toLocalDate();
            }
            String s = cellString(cell);
            if (s == null) return null;
            for (DateTimeFormatter fmt : DATE_FORMATS) {
                try {
                    return LocalDate.parse(s, fmt);
                } catch (Exception ignored) { /* try next format */ }
            }
        } catch (Exception ignored) { /* fall through */ }
        return null;
    }

    private boolean isEmptyRow(Row row) {
        if (row == null) return true;
        for (int c = 0; c < HEADERS.size(); c++) {
            String v = cellString(row.getCell(c));
            if (v != null && !v.isBlank()) return false;
        }
        return true;
    }

    /**
     * Thrown when an import fails validation — carries the full row-by-row
     * report so the controller can return it as a 400 response body. Not a
     * BusinessException because the body shape is structured, not a string.
     */
    public static class ImportValidationException extends RuntimeException {
        private final StudentImportErrorReport report;
        public ImportValidationException(StudentImportErrorReport report) {
            super("Import validation failed: " + report.getErrors().size() + " row(s) have errors");
            this.report = report;
        }
        public StudentImportErrorReport getReport() { return report; }
    }
}
