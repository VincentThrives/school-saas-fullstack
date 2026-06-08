package com.saas.school.modules.reportcard.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.attendance.model.Attendance;
import com.saas.school.modules.attendance.repository.AttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.model.ComponentInternalMark;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.exam.repository.ComponentInternalMarkRepository;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import com.saas.school.modules.reportcard.model.ReportCard;
import com.saas.school.modules.reportcard.repository.ReportCardRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ReportCardService {

    private static final Logger logger = LoggerFactory.getLogger(ReportCardService.class);

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamMarkRepository examMarkRepository;

    @Autowired
    private StudentAssessmentsRepository assessmentsRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private ReportCardRepository reportCardRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private ComponentInternalMarkRepository internalMarkRepository;

    @Autowired
    private com.saas.school.modules.academicyear.repository.AcademicYearRepository academicYearRepository;

    public ReportCard generateReportCard(String studentId, String academicYearId, String examType) {
        logger.info("Generating report card for studentId={}, academicYearId={}, examType={}", studentId, academicYearId, examType);
        if (examType == null || examType.isBlank()) {
            throw new IllegalArgumentException("Exam type is required. Please select an exam type (e.g. Sem 1, Final) before generating a report card.");
        }

        Student student = studentRepository.findById(studentId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));

        // Get student name - from student directly or from linked user
        String studentName;
        if (student.getFirstName() != null && !student.getFirstName().isEmpty()) {
            studentName = student.getFirstName() + " " + (student.getLastName() != null ? student.getLastName() : "");
        } else if (student.getUserId() != null) {
            User user = userRepository.findById(student.getUserId()).orElse(null);
            studentName = user != null ? user.getFirstName() + " " + user.getLastName() : "Student " + student.getAdmissionNumber();
        } else {
            studentName = "Student " + (student.getAdmissionNumber() != null ? student.getAdmissionNumber() : studentId);
        }

        String className = "";
        String sectionName = "";
        String classId = student.getClassId();
        if (classId != null) {
            SchoolClass schoolClass = schoolClassRepository.findById(classId).orElse(null);
            if (schoolClass != null) {
                className = schoolClass.getName();
                if (student.getSectionId() != null && schoolClass.getSections() != null) {
                    schoolClass.getSections().stream()
                        .filter(s -> student.getSectionId().equals(s.getSectionId()))
                        .findFirst()
                        .ifPresent(s -> { });
                    for (var sec : schoolClass.getSections()) {
                        if (student.getSectionId().equals(sec.getSectionId())) {
                            sectionName = sec.getName();
                            break;
                        }
                    }
                }
            }
        }

        // Fetch exams for the student's class and academic year, optionally filtered by exam type
        List<Exam> exams = examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        if (examType != null && !examType.isEmpty()) {
            exams = exams.stream().filter(e -> examType.equals(e.getExamType())).collect(Collectors.toList());
        }
        List<String> examIds = exams.stream().map(Exam::getExamId).collect(Collectors.toList());

        // Build a map of examId -> Exam for lookup
        Map<String, Exam> examMap = new HashMap<>();
        for (Exam exam : exams) {
            examMap.put(exam.getExamId(), exam);
        }

        // Fetch marks — try StudentAssessments (batch) first, fallback to ExamMark (legacy)
        // Build a simple list of (examId, marksObtained) per student
        Map<String, Double> examMarksMap = new HashMap<>(); // examId -> marks obtained

        // Check batch marks (StudentAssessments)
        List<StudentAssessments> batchList = assessmentsRepository.findByExamIdIn(examIds);
        for (StudentAssessments batch : batchList) {
            if (batch.getEntries() == null) continue;
            for (StudentAssessments.MarkEntry entry : batch.getEntries()) {
                if (studentId.equals(entry.getStudentId())) {
                    examMarksMap.put(batch.getExamId(), entry.getMarksObtained() != null ? entry.getMarksObtained() : 0.0);
                }
            }
        }

        // Fallback to legacy ExamMark for exams not found in batch
        if (examMarksMap.isEmpty()) {
            List<ExamMark> marks = examMarkRepository.findByStudentIdAndExamIdIn(studentId, examIds);
            for (ExamMark mark : marks) {
                examMarksMap.putIfAbsent(mark.getExamId(), mark.getMarksObtained() != null ? mark.getMarksObtained() : 0.0);
            }
        }

        // Build the subject-name lookup from the real Subject collection
        // rather than a hardcoded list — every school configures its own
        // subjects, so a baked-in catalog would only mislead report cards
        // for any subject the school hasn't named after one of these
        // common Indian-board patterns.
        Map<String, String> allSubjects = new java.util.LinkedHashMap<>();
        for (Subject s : subjectRepository.findAll()) {
            if (s.getSubjectId() != null && s.getName() != null) {
                allSubjects.put(s.getSubjectId(), s.getName());
            }
        }

        // Aggregate marks per subject from exams
        Map<String, Double> subjectMarksObtained = new HashMap<>();
        Map<String, Double> subjectMaxMarks = new HashMap<>();
        Map<String, String> subjectNamesFromExams = new HashMap<>();
        // Track which subjects should be rendered "Absent" (a matching exam exists
        // for the selected type, but this student has no marks entry for it).
        Set<String> absentSubjectIds = new HashSet<>();

        boolean specificExamType = examType != null && !examType.isEmpty();

        if (specificExamType) {
            // ── One exam per subject rule ───────────────────────────
            // For a specific exam type (e.g. "Sem 1"), pick exactly ONE exam per
            // subject — the most recent by examDate, falling back to createdAt —
            // and use that single exam's marks/maxMarks. No summing, no duplicates.
            Map<String, Exam> bestExamBySubject = new HashMap<>();
            for (Exam exam : exams) {
                String subjectId = exam.getSubjectId();
                if (subjectId == null) continue;
                Exam current = bestExamBySubject.get(subjectId);
                if (current == null || isNewerExam(exam, current)) {
                    bestExamBySubject.put(subjectId, exam);
                }
            }

            for (Map.Entry<String, Exam> e : bestExamBySubject.entrySet()) {
                String subjectId = e.getKey();
                Exam exam = e.getValue();
                String subjectName = allSubjects.getOrDefault(
                    subjectId, exam.getSubjectName() != null ? exam.getSubjectName() : subjectId);
                subjectNamesFromExams.put(subjectId, subjectName);

                subjectMaxMarks.put(subjectId, (double) exam.getMaxMarks());
                Double obtained = examMarksMap.get(exam.getExamId());
                if (obtained != null) {
                    subjectMarksObtained.put(subjectId, obtained);
                } else {
                    // Student was absent / marks not entered for this subject's exam
                    subjectMarksObtained.put(subjectId, 0.0);
                    absentSubjectIds.add(subjectId);
                }
            }
        } else {
            // ── All Exam Types: cumulative across every exam (existing behavior) ──
            for (Map.Entry<String, Double> entry : examMarksMap.entrySet()) {
                Exam exam = examMap.get(entry.getKey());
                if (exam == null) continue;
                String subjectId = exam.getSubjectId();
                String subjectName = allSubjects.getOrDefault(subjectId, exam.getSubjectName() != null ? exam.getSubjectName() : subjectId);
                subjectNamesFromExams.putIfAbsent(subjectId, subjectName);
                subjectMarksObtained.merge(subjectId, entry.getValue(), Double::sum);
                subjectMaxMarks.merge(subjectId, (double) exam.getMaxMarks(), Double::sum);
            }
        }

        // Build subject grades — include all subjects that have marks
        List<ReportCard.SubjectGrade> subjectGrades = new ArrayList<>();
        double totalMarks = 0;
        double totalMaxMarks = 0;

        // Use subjects from exams (not all standard subjects — only show subjects with data)
        Map<String, String> subjectNames = subjectNamesFromExams.isEmpty() ? allSubjects : subjectNamesFromExams;

        // Pre-fetch this student's internal marks once (for INTERNAL-mode components).
        // Spans the whole year — we filter per (subject, component) in the loop.
        List<ComponentInternalMark> allInternalMarks =
                internalMarkRepository.findByStudentIdAndAcademicYearId(studentId, academicYearId);

        for (String subjectId : subjectNames.keySet()) {
            double obtained = subjectMarksObtained.getOrDefault(subjectId, 0.0);
            double max = subjectMaxMarks.getOrDefault(subjectId, 0.0);
            boolean isAbsent = absentSubjectIds.contains(subjectId);

            // Try to enrich with per-component breakdown. For component-shaped
            // subjects this also overrides obtained/max with the component sum,
            // so internal marks (which live outside the Exam table) get included
            // in the subject total.
            Subject subject = subjectRepository.findById(subjectId).orElse(null);
            List<ReportCard.ComponentGrade> componentGrades = null;
            boolean subjectPassed = !isAbsent;
            if (subject != null && subject.getComponents() != null && !subject.getComponents().isEmpty()) {
                ComponentAggregate agg = aggregateComponents(
                        subject, studentId, academicYearId, exams, examMarksMap, allInternalMarks);
                componentGrades = agg.componentGrades;
                obtained = agg.totalObtained;
                max = agg.totalMax;
                subjectPassed = !isAbsent && agg.subjectPassed;
            }

            double pct = max > 0 ? (obtained / max) * 100 : 0;
            String grade = isAbsent ? "—" : calculateGrade(pct);

            // Skip subjects with no configured max
            if (max <= 0) continue;

            ReportCard.SubjectGrade sg = new ReportCard.SubjectGrade();
            sg.setSubjectId(subjectId);
            // Use proper name from allSubjects map, fallback to exam name
            sg.setSubjectName(allSubjects.getOrDefault(subjectId, subjectNames.get(subjectId)));
            sg.setMarksObtained(obtained);
            sg.setMaxMarks(max);
            sg.setGrade(grade);
            sg.setAbsent(isAbsent);
            sg.setPassed(subjectPassed);
            sg.setComponents(componentGrades);
            subjectGrades.add(sg);

            totalMarks += obtained;
            totalMaxMarks += max;
        }

        double overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
        String overallGrade = calculateGrade(overallPercentage);

        // Calculate attendance percentage
        double attendancePercentage = calculateAttendancePercentage(studentId, academicYearId);

        // Calculate rank among classmates
        int rank = calculateRank(studentId, classId, academicYearId, overallPercentage);

        // Build and save report card
        ReportCard reportCard = new ReportCard();
        reportCard.setStudentId(studentId);
        reportCard.setStudentName(studentName.trim());
        reportCard.setClassId(classId);
        reportCard.setClassName(className);
        reportCard.setAcademicYearId(academicYearId);
        // Fetch academic year label
        academicYearRepository.findById(academicYearId).ifPresent(ay ->
            reportCard.setAcademicYearLabel(ay.getLabel())
        );
        reportCard.setExamType(specificExamType ? examType : null);
        reportCard.setSubjects(subjectGrades);
        reportCard.setTotalMarks(totalMarks);
        reportCard.setTotalMaxMarks(totalMaxMarks);
        reportCard.setPercentage(Math.round(overallPercentage * 100.0) / 100.0);
        reportCard.setGrade(overallGrade);
        reportCard.setRank(rank);
        reportCard.setAttendancePercentage(Math.round(attendancePercentage * 100.0) / 100.0);
        // Overall pass = every subject passed. A single failed subject (e.g.
        // Practical below its per-component pass cap) flips the whole card
        // to FAIL, even if the aggregate percentage clears 35%.
        boolean allSubjectsPassed = !subjectGrades.isEmpty()
                && subjectGrades.stream().allMatch(ReportCard.SubjectGrade::isPassed);
        reportCard.setPassed(allSubjectsPassed);

        ReportCard saved = reportCardRepository.save(reportCard);
        logger.info("Report card generated and saved for studentId={}, id={}", studentId, saved.getId());
        return saved;
    }

    public byte[] generateReportCardPdf(String reportCardId, String tenantId) {
        logger.info("Generating report card PDF for reportCardId={}, tenantId={}", reportCardId, tenantId);

        ReportCard reportCard = reportCardRepository.findById(reportCardId)
                .orElseThrow(() -> new ResourceNotFoundException("Report card not found with id: " + reportCardId));

        // Lookup tenant in CENTRAL DB (clear tenant context temporarily)
        String currentTenant = com.saas.school.config.mongodb.TenantContext.getTenantId();
        com.saas.school.config.mongodb.TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));
        // Restore tenant context
        if (currentTenant != null) {
            com.saas.school.config.mongodb.TenantContext.setTenantId(currentTenant);
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            pdfDoc.setDefaultPageSize(PageSize.A4);
            Document document = new Document(pdfDoc);
            // Compact margins to fit single page
            document.setMargins(20, 25, 15, 25);

            // ── School Logo Space ──
            document.add(new Paragraph("[School Logo]")
                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)
                    .setFontColor(ColorConstants.LIGHT_GRAY).setMarginBottom(2));

            // ── School Header ──
            document.add(new Paragraph(tenant.getSchoolName())
                    .setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER).setMarginBottom(1));

            if (tenant.getAddress() != null) {
                StringBuilder addressStr = new StringBuilder();
                if (tenant.getAddress().getStreet() != null) addressStr.append(tenant.getAddress().getStreet()).append(", ");
                if (tenant.getAddress().getCity() != null) addressStr.append(tenant.getAddress().getCity()).append(", ");
                if (tenant.getAddress().getState() != null) addressStr.append(tenant.getAddress().getState());
                if (tenant.getAddress().getZip() != null) addressStr.append(" - ").append(tenant.getAddress().getZip());
                if (addressStr.length() > 0) {
                    document.add(new Paragraph(addressStr.toString())
                            .setFontSize(7).setTextAlignment(TextAlignment.CENTER)
                            .setFontColor(ColorConstants.GRAY).setMarginBottom(1));
                }
            }

            if (tenant.getContactPhone() != null) {
                document.add(new Paragraph("Ph: " + tenant.getContactPhone() + " | " + tenant.getContactEmail())
                        .setFontSize(7).setTextAlignment(TextAlignment.CENTER)
                        .setFontColor(ColorConstants.GRAY).setMarginBottom(2));
            }

            // ── Separator ──
            document.add(new Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                    .setTextAlignment(TextAlignment.CENTER).setFontSize(6).setMarginBottom(2));

            document.add(new Paragraph("REPORT CARD")
                    .setBold().setFontSize(13).setTextAlignment(TextAlignment.CENTER).setMarginBottom(6));

            // ── Student Info ──
            Table infoTable = new Table(UnitValue.createPercentArray(new float[]{18, 32, 18, 32}));
            infoTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(6);

            // Fetch student for extra details
            Student studentForPdf = studentRepository.findById(reportCard.getStudentId()).orElse(null);
            String sectionNamePdf = "-";
            if (studentForPdf != null && studentForPdf.getClassId() != null) {
                SchoolClass cls = schoolClassRepository.findById(studentForPdf.getClassId()).orElse(null);
                if (cls != null && studentForPdf.getSectionId() != null && cls.getSections() != null) {
                    for (var sec : cls.getSections()) {
                        if (studentForPdf.getSectionId().equals(sec.getSectionId())) {
                            sectionNamePdf = sec.getName();
                            break;
                        }
                    }
                }
            }

            addCompactInfoCell(infoTable, "Student Name:", reportCard.getStudentName());
            addCompactInfoCell(infoTable, "Class:", reportCard.getClassName());
            addCompactInfoCell(infoTable, "Section:", sectionNamePdf);
            addCompactInfoCell(infoTable, "Adm. No:", studentForPdf != null && studentForPdf.getAdmissionNumber() != null ? studentForPdf.getAdmissionNumber() : "-");
            addCompactInfoCell(infoTable, "Roll No:", studentForPdf != null && studentForPdf.getRollNumber() != null ? studentForPdf.getRollNumber() : "-");
            addCompactInfoCell(infoTable, "Academic Year:", reportCard.getAcademicYearLabel() != null ? reportCard.getAcademicYearLabel() : reportCard.getAcademicYearId());
            addCompactInfoCell(infoTable, "DOB:", studentForPdf != null && studentForPdf.getDateOfBirth() != null ? studentForPdf.getDateOfBirth().toString() : "-");
            addCompactInfoCell(infoTable, "Rank:", String.valueOf(reportCard.getRank()));
            document.add(infoTable);

            // ── Marks Table ──
            //
            // One row PER subject. For hybrid subjects (Theory + Practical,
            // etc.) each component gets its own column instead of a separate
            // sub-row, so parents read a clean grid:
            //
            //   # | Subject | Theory | Practical | Marks | Max | Grade
            //   1 | English | 65/70  | 10/30 ✗   | 75    | 100 | B+   (FAIL)
            //
            // The Theory/Practical column set is derived from the UNION of
            // components across all subjects, preserving first-seen order.
            // Subjects that don't use a given component show "—".
            List<ReportCard.SubjectGrade> subjects = reportCard.getSubjects();
            List<String> componentLabels = new ArrayList<>();
            if (subjects != null) {
                for (ReportCard.SubjectGrade sg : subjects) {
                    if (sg.getComponents() == null) continue;
                    for (ReportCard.ComponentGrade cg : sg.getComponents()) {
                        if (cg.getLabel() != null && !componentLabels.contains(cg.getLabel())) {
                            componentLabels.add(cg.getLabel());
                        }
                    }
                }
            }

            // Width layout: # + Subject + N component cols + Marks + Max + Grade.
            // Numbers chosen so the table totals ~100 for 0–3 component columns
            // without crowding the trailing summary cells.
            int compCount = componentLabels.size();
            float[] widths = new float[5 + compCount];
            widths[0] = 6;                          // #
            widths[1] = compCount == 0 ? 32 : 24;   // Subject — wider when no comp cols
            for (int c = 0; c < compCount; c++) widths[2 + c] = 13;
            widths[2 + compCount]     = 12;         // Marks Obtained
            widths[3 + compCount]     = 10;         // Max Marks
            widths[4 + compCount]     = 10;         // Grade
            Table marksTable = new Table(UnitValue.createPercentArray(widths));
            marksTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);

            addCompactHeaderCell(marksTable, "#");
            addCompactHeaderCell(marksTable, "Subject");
            for (String lbl : componentLabels) addCompactHeaderCell(marksTable, lbl);
            addCompactHeaderCell(marksTable, "Marks Obtained");
            addCompactHeaderCell(marksTable, "Max Marks");
            addCompactHeaderCell(marksTable, "Grade");

            if (subjects != null) {
                // Light red tint on failed subject rows so parents see the
                // problem subject at a glance.
                DeviceRgb failTint = new DeviceRgb(252, 232, 232);
                for (int i = 0; i < subjects.size(); i++) {
                    ReportCard.SubjectGrade sg = subjects.get(i);
                    boolean subjectFailed = !sg.isPassed() && !sg.isAbsent();
                    String subjLabel = sg.getSubjectName()
                            + (subjectFailed ? "  (FAIL)" : "");

                    Cell numC = new Cell().add(new Paragraph(String.valueOf(i + 1)).setFontSize(8)).setPadding(2);
                    Cell subC = new Cell().add(new Paragraph(subjLabel).setBold().setFontSize(8)).setPadding(2);
                    if (subjectFailed) { numC.setBackgroundColor(failTint); subC.setBackgroundColor(failTint); }
                    marksTable.addCell(numC);
                    marksTable.addCell(subC);

                    // Index this subject's components by label for fast column lookup.
                    Map<String, ReportCard.ComponentGrade> compByLabel = new HashMap<>();
                    if (sg.getComponents() != null) {
                        for (ReportCard.ComponentGrade cg : sg.getComponents()) {
                            if (cg.getLabel() != null) compByLabel.put(cg.getLabel(), cg);
                        }
                    }
                    for (String lbl : componentLabels) {
                        ReportCard.ComponentGrade cg = compByLabel.get(lbl);
                        Cell c;
                        if (cg == null) {
                            // Subject doesn't have this component — show a dash.
                            c = new Cell().add(new Paragraph("—")
                                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                        } else {
                            String mark = trimDecimal(cg.getMarksObtained()) + " / " + trimDecimal(cg.getMaxMarks());
                            if (!cg.isPassed()) mark += "  ✗";
                            c = new Cell().add(new Paragraph(mark)
                                    .setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                            if (!cg.isPassed()) c.setBackgroundColor(failTint);
                        }
                        // Tint the whole row if the subject itself failed,
                        // overriding only when the cell is already tinted as a
                        // failed component (no harm — same colour).
                        if (subjectFailed && cg != null && cg.isPassed()) c.setBackgroundColor(failTint);
                        if (subjectFailed && cg == null) c.setBackgroundColor(failTint);
                        marksTable.addCell(c);
                    }

                    Cell obtC = new Cell().add(new Paragraph(trimDecimal(sg.getMarksObtained())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    Cell maxC = new Cell().add(new Paragraph(trimDecimal(sg.getMaxMarks())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    Cell grdC = new Cell().add(new Paragraph(sg.getGrade()).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2);
                    if (subjectFailed) {
                        obtC.setBackgroundColor(failTint);
                        maxC.setBackgroundColor(failTint);
                        grdC.setBackgroundColor(failTint);
                    }
                    marksTable.addCell(obtC);
                    marksTable.addCell(maxC);
                    marksTable.addCell(grdC);
                }
            }

            // Total row — TOTAL label spans # + Subject + every component column.
            int totalLabelSpan = 2 + compCount;
            marksTable.addCell(new Cell(1, totalLabelSpan).add(new Paragraph("TOTAL").setBold().setFontSize(8)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(trimDecimal(reportCard.getTotalMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(trimDecimal(reportCard.getTotalMaxMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(reportCard.getGrade()).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            document.add(marksTable);

            // ── Result Summary ──
            Table resultTable = new Table(UnitValue.createPercentArray(new float[]{25, 25, 25, 25}));
            resultTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);

            Cell pctLabel = new Cell().setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(3);
            pctLabel.add(new Paragraph("Percentage").setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            resultTable.addCell(pctLabel);
            resultTable.addCell(new Cell().add(new Paragraph(reportCard.getPercentage() + "%").setBold().setFontSize(10).setTextAlignment(TextAlignment.CENTER)).setPadding(3));

            Cell gradeLabel = new Cell().setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(3);
            gradeLabel.add(new Paragraph("Grade").setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            resultTable.addCell(gradeLabel);
            resultTable.addCell(new Cell().add(new Paragraph(reportCard.getGrade()).setBold().setFontSize(11).setTextAlignment(TextAlignment.CENTER)).setPadding(3));
            document.add(resultTable);

            // ── PASS / FAIL ──
            // Use the persisted per-subject roll-up rather than a flat
            // percentage threshold — a single failed subject (e.g. a
            // Practical below its component pass cap) flips the card to
            // FAIL even if the average looks healthy.
            String result = reportCard.isPassed() ? "PASS" : "FAIL";
            document.add(new Paragraph("Result: " + result)
                    .setBold().setFontSize(12).setTextAlignment(TextAlignment.CENTER).setMarginBottom(6));

            // ── Remarks ──
            if (reportCard.getTeacherRemarks() != null && !reportCard.getTeacherRemarks().isEmpty()) {
                document.add(new Paragraph("Teacher's Remarks: " + reportCard.getTeacherRemarks()).setFontSize(8).setMarginBottom(2));
            }
            if (reportCard.getPrincipalRemarks() != null && !reportCard.getPrincipalRemarks().isEmpty()) {
                document.add(new Paragraph("Principal's Remarks: " + reportCard.getPrincipalRemarks()).setFontSize(8).setMarginBottom(2));
            }

            // ── Signature Area ──
            document.add(new Paragraph("\n"));
            Table stampTable = new Table(UnitValue.createPercentArray(new float[]{30, 40, 30}));
            stampTable.setWidth(UnitValue.createPercentValue(100));

            Cell teacherCell = new Cell().setBorder(Border.NO_BORDER);
            teacherCell.add(new Paragraph("\n\n").setFontSize(4));
            teacherCell.add(new Paragraph("____________________").setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            teacherCell.add(new Paragraph("Class Teacher").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setBold());
            stampTable.addCell(teacherCell);

            Cell sealCell = new Cell().setBorder(Border.NO_BORDER);
            sealCell.add(new Paragraph("\n").setFontSize(4));
            sealCell.add(new Paragraph("[School Seal]").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.LIGHT_GRAY));
            stampTable.addCell(sealCell);

            Cell principalCell = new Cell().setBorder(Border.NO_BORDER);
            principalCell.add(new Paragraph("\n\n").setFontSize(4));
            principalCell.add(new Paragraph("____________________").setFontSize(8).setTextAlignment(TextAlignment.CENTER));
            principalCell.add(new Paragraph("Principal").setFontSize(7).setTextAlignment(TextAlignment.CENTER).setBold());
            stampTable.addCell(principalCell);
            document.add(stampTable);

            // ── Footer ──
            document.add(new Paragraph("This is a computer-generated report card.")
                    .setFontSize(6).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.GRAY).setMarginTop(5));

            document.close();
            logger.info("Report card PDF generated successfully for reportCardId={}", reportCardId);
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating report card PDF for reportCardId={}: {}", reportCardId, e.getMessage(), e);
            throw new RuntimeException("Failed to generate report card PDF", e);
        }
    }

    public List<ReportCard> generateBulkReportCards(String classId, String academicYearId, String examType) {
        logger.info("Generating bulk report cards for classId={}, academicYearId={}, examType={}", classId, academicYearId, examType);

        List<Student> students = studentRepository.findByClassIdAndDeletedAtIsNull(classId, Pageable.unpaged()).getContent();
        List<ReportCard> reportCards = new ArrayList<>();

        for (Student student : students) {
            try {
                ReportCard rc = generateReportCard(student.getStudentId(), academicYearId, examType);
                reportCards.add(rc);
            } catch (Exception e) {
                logger.error("Error generating report card for studentId={}: {}", student.getStudentId(), e.getMessage());
            }
        }

        // Recalculate ranks based on percentage
        reportCards.sort((a, b) -> Double.compare(b.getPercentage(), a.getPercentage()));
        for (int i = 0; i < reportCards.size(); i++) {
            reportCards.get(i).setRank(i + 1);
            reportCardRepository.save(reportCards.get(i));
        }

        logger.info("Bulk report cards generated: {} cards for classId={}", reportCards.size(), classId);
        return reportCards;
    }

    public byte[] generateBulkPdf(String classId, String academicYearId, String examType, String tenantId) {
        logger.info("Generating bulk PDF zip for classId={}, academicYearId={}, examType={}", classId, academicYearId, examType);

        List<ReportCard> reportCards = generateBulkReportCards(classId, academicYearId, examType);

        try {
            ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();
            ZipOutputStream zipOut = new ZipOutputStream(zipBaos);

            for (ReportCard rc : reportCards) {
                try {
                    byte[] pdfBytes = generateReportCardPdf(rc.getId(), tenantId);
                    String fileName = "report_card_" + (rc.getStudentName() != null ? rc.getStudentName().replaceAll("[^a-zA-Z0-9]", "_") : rc.getStudentId()) + ".pdf";
                    zipOut.putNextEntry(new ZipEntry(fileName));
                    zipOut.write(pdfBytes);
                    zipOut.closeEntry();
                } catch (Exception e) {
                    logger.error("Error generating PDF for student {}: {}", rc.getStudentId(), e.getMessage());
                }
            }

            zipOut.close();
            logger.info("Bulk PDF zip generated with {} report cards", reportCards.size());
            return zipBaos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating bulk PDF zip: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate bulk PDF zip", e);
        }
    }

    private String calculateGrade(double percentage) {
        if (percentage >= 90) return "A+";
        if (percentage >= 80) return "A";
        if (percentage >= 70) return "B+";
        if (percentage >= 60) return "B";
        if (percentage >= 50) return "C";
        if (percentage >= 40) return "D";
        return "F";
    }

    // ── Per-component aggregation helpers ─────────────────────────────

    /** Bundles the per-component breakdown plus rolled-up subject totals. */
    private static class ComponentAggregate {
        List<ReportCard.ComponentGrade> componentGrades = new ArrayList<>();
        double totalObtained;
        double totalMax;
        boolean subjectPassed;
    }

    /**
     * Build per-component grades for a given subject and student.
     *
     * <p>For EXAM components: walk the supplied exam list, sum marks
     * where {@code exam.subjectId == subject.id} and
     * {@code exam.componentKey} matches (or is null on a
     * single-component subject).
     *
     * <p>For INTERNAL components: pull from the pre-fetched internal
     * marks list, sum across terms / pick the single year-scoped row.
     *
     * <p>Subject pass/fail is computed using the subject's
     * {@code passRule}:
     * <ul>
     *   <li>{@code PER_COMPONENT}: subject passes iff every component passes
     *   <li>{@code COMBINED}: subject passes iff total obtained &gt;= total pass marks
     * </ul>
     */
    private ComponentAggregate aggregateComponents(
            Subject subject,
            String studentId,
            String academicYearId,
            List<Exam> exams,
            Map<String, Double> examMarksByExamId,
            List<ComponentInternalMark> allInternalMarks) {
        ComponentAggregate out = new ComponentAggregate();
        Subject.PassRule passRule = subject.getPassRule() == null
                ? Subject.PassRule.PER_COMPONENT
                : subject.getPassRule();
        double sumPassMarks = 0;
        boolean everyComponentPassed = true;

        for (Subject.Component comp : subject.getComponents()) {
            ReportCard.ComponentGrade cg = new ReportCard.ComponentGrade();
            cg.setKey(comp.getKey());
            cg.setLabel(comp.getLabel());
            cg.setMaxMarks(comp.getMaxMarks() == null ? 0 : comp.getMaxMarks());
            cg.setPassMarks(comp.getPassMarks() == null ? 0 : comp.getPassMarks());
            cg.setAssessmentMode(comp.getAssessmentMode() == null ? "EXAM" : comp.getAssessmentMode().name());

            double obtained = 0;
            if (comp.getAssessmentMode() == Subject.AssessmentMode.INTERNAL) {
                // Sum INTERNAL marks for this (subject, component). For
                // PER_TERM components this sums across terms; for PER_YEAR
                // it's a single row.
                for (ComponentInternalMark m : allInternalMarks) {
                    if (!subject.getSubjectId().equals(m.getSubjectId())) continue;
                    if (!comp.getKey().equals(m.getComponentKey())) continue;
                    if (m.getMarksObtained() != null) obtained += m.getMarksObtained();
                }
            } else {
                // EXAM mode — match exams by componentKey. For single-component
                // subjects exam.componentKey may be null (legacy clients);
                // treat null as a match in that case.
                boolean isSingleComponent = subject.getComponents().size() == 1;
                for (Exam exam : exams) {
                    if (!subject.getSubjectId().equals(exam.getSubjectId())) continue;
                    String examCk = exam.getComponentKey();
                    boolean componentMatches = comp.getKey().equals(examCk)
                            || (isSingleComponent && (examCk == null || examCk.isBlank()));
                    if (!componentMatches) continue;
                    Double m = examMarksByExamId.get(exam.getExamId());
                    if (m != null) obtained += m;
                }
            }
            cg.setMarksObtained(obtained);
            boolean componentPassed = obtained >= cg.getPassMarks();
            cg.setPassed(componentPassed);

            // Per-component attendance % for trackAttendance components.
            if (comp.isTrackAttendance()) {
                cg.setAttendancePercentage(calculateComponentAttendance(
                        studentId, academicYearId, subject.getSubjectId(), comp.getKey()));
            }

            out.componentGrades.add(cg);
            out.totalObtained += obtained;
            out.totalMax += cg.getMaxMarks();
            sumPassMarks += cg.getPassMarks();
            if (!componentPassed) everyComponentPassed = false;
        }

        if (passRule == Subject.PassRule.PER_COMPONENT) {
            out.subjectPassed = everyComponentPassed;
        } else {
            out.subjectPassed = out.totalObtained >= sumPassMarks;
        }
        return out;
    }

    /**
     * Per-component attendance % for the given student. Walks Attendance
     * rows tagged with the matching {@code subjectId + componentKey} for
     * the academic year. Returns null when there are no records (so the
     * UI can show "—" instead of misleadingly displaying 0%).
     */
    private Double calculateComponentAttendance(
            String studentId, String academicYearId, String subjectId, String componentKey) {
        // Pull this student's attendance over a wide date window, then filter
        // in-memory by subject + component. The wide window covers any
        // reasonable academic year shape (Indian school years run Jun–Apr).
        LocalDate from = LocalDate.now().minusYears(2);
        LocalDate to = LocalDate.now().plusDays(1);
        List<Attendance> rows = attendanceRepository.findByStudentIdAndDateBetween(studentId, from, to);
        if (rows == null || rows.isEmpty()) return null;
        int total = 0;
        int present = 0;
        for (Attendance a : rows) {
            if (!academicYearId.equals(a.getAcademicYearId())) continue;
            if (!subjectId.equals(a.getSubjectId())) continue;
            String aCk = a.getComponentKey();
            // Treat null componentKey as a match for the only component (legacy rows).
            if (!componentKey.equals(aCk) && aCk != null) continue;
            total++;
            if (a.getStatus() == Attendance.Status.PRESENT || a.getStatus() == Attendance.Status.LATE) {
                present++;
            }
        }
        if (total == 0) return null;
        return Math.round((present * 1000.0 / total)) / 10.0;
    }

    /**
     * Pick the "newer" of two exams. Prefer examDate; fall back to createdAt.
     * Used when filtering by a specific exam type and more than one exam exists
     * for the same subject — we keep the most recent run.
     */
    private boolean isNewerExam(Exam a, Exam b) {
        LocalDate ad = a.getExamDate();
        LocalDate bd = b.getExamDate();
        if (ad != null && bd != null) return ad.isAfter(bd);
        if (ad != null) return true;
        if (bd != null) return false;
        Instant ac = a.getCreatedAt();
        Instant bc = b.getCreatedAt();
        if (ac != null && bc != null) return ac.isAfter(bc);
        return false;
    }

    private double calculateAttendancePercentage(String studentId, String academicYearId) {
        try {
            LocalDate startDate = LocalDate.of(LocalDate.now().getYear(), 4, 1);
            LocalDate endDate = LocalDate.now();

            long totalDays = attendanceRepository.countByStudentIdAndDateBetween(studentId, startDate, endDate);
            if (totalDays == 0) {
                return 100.0;
            }

            long presentDays = attendanceRepository.countByStudentIdAndStatusAndDateBetween(
                    studentId, Attendance.Status.PRESENT, startDate, endDate);

            return ((double) presentDays / totalDays) * 100;
        } catch (Exception e) {
            logger.warn("Could not calculate attendance for studentId={}: {}", studentId, e.getMessage());
            return 0.0;
        }
    }

    private int calculateRank(String studentId, String classId, String academicYearId, double studentPercentage) {
        try {
            List<ReportCard> classReports = reportCardRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
            int rank = 1;
            for (ReportCard rc : classReports) {
                if (!rc.getStudentId().equals(studentId) && rc.getPercentage() > studentPercentage) {
                    rank++;
                }
            }
            return rank;
        } catch (Exception e) {
            logger.warn("Could not calculate rank for studentId={}: {}", studentId, e.getMessage());
            return 0;
        }
    }

    private void addHeaderCell(Table table, String text) {
        Cell cell = new Cell();
        cell.setBackgroundColor(ColorConstants.LIGHT_GRAY);
        cell.add(new Paragraph(text).setBold().setFontSize(10).setTextAlignment(TextAlignment.CENTER));
        table.addCell(cell);
    }

    private void addInfoCell(Table table, String label, String value) {
        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .add(new Paragraph(label).setBold().setFontSize(10)));
        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .add(new Paragraph(value != null ? value : "N/A").setFontSize(10)));
    }

    private void addCompactInfoCell(Table table, String label, String value) {
        table.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(new Paragraph(label).setBold().setFontSize(8)));
        table.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(1)
                .add(new Paragraph(value != null ? value : "-").setFontSize(8)));
    }

    private void addCompactHeaderCell(Table table, String text) {
        Cell cell = new Cell();
        cell.setBackgroundColor(ColorConstants.LIGHT_GRAY).setPadding(2);
        cell.add(new Paragraph(text).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER));
        table.addCell(cell);
    }

    /**
     * Strip a trailing ".0" from whole-number marks so the table reads
     * "65 / 70" instead of "65.0 / 70.0". Fractional marks keep their
     * decimal so 75.5 stays accurate.
     */
    private String trimDecimal(double v) {
        if (v == Math.floor(v) && !Double.isInfinite(v)) {
            return String.valueOf((long) v);
        }
        return String.valueOf(v);
    }
}
