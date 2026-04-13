package com.saas.school.modules.reportcard.service;

import com.itextpdf.kernel.colors.ColorConstants;
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
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReportCardService {

    private static final Logger logger = LoggerFactory.getLogger(ReportCardService.class);

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamMarkRepository examMarkRepository;

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

    public ReportCard generateReportCard(String studentId, String academicYearId) {
        logger.info("Generating report card for studentId={}, academicYearId={}", studentId, academicYearId);

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

        // Fetch all exams for the student's class and academic year
        List<Exam> exams = examRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
        List<String> examIds = exams.stream().map(Exam::getExamId).collect(Collectors.toList());

        // Fetch marks for this student across all exams
        List<ExamMark> marks = examMarkRepository.findByStudentIdAndExamIdIn(studentId, examIds);

        // Build a map of examId -> Exam for lookup
        Map<String, Exam> examMap = new HashMap<>();
        for (Exam exam : exams) {
            examMap.put(exam.getExamId(), exam);
        }

        // Standard subjects list
        Map<String, String> allSubjects = new java.util.LinkedHashMap<>();
        allSubjects.put("kannada", "Kannada");
        allSubjects.put("english", "English");
        allSubjects.put("hindi", "Hindi");
        allSubjects.put("math", "Mathematics");
        allSubjects.put("maths", "Mathematics");
        allSubjects.put("science", "Science");
        allSubjects.put("social", "Social Science");
        allSubjects.put("history", "History");
        allSubjects.put("geography", "Geography");
        allSubjects.put("physics", "Physics");
        allSubjects.put("chemistry", "Chemistry");
        allSubjects.put("biology", "Biology");
        allSubjects.put("computer", "Computer Science");
        allSubjects.put("sanskrit", "Sanskrit");
        allSubjects.put("evs", "EVS");
        allSubjects.put("pe", "Physical Education");
        allSubjects.put("art", "Art & Craft");
        allSubjects.put("music", "Music");
        allSubjects.put("moral", "Moral Science");

        // Aggregate marks per subject from exams
        Map<String, Double> subjectMarksObtained = new HashMap<>();
        Map<String, Double> subjectMaxMarks = new HashMap<>();
        Map<String, String> subjectNamesFromExams = new HashMap<>();

        for (ExamMark mark : marks) {
            Exam exam = examMap.get(mark.getExamId());
            if (exam == null) continue;
            String subjectId = exam.getSubjectId();
            String subjectName = allSubjects.getOrDefault(subjectId, exam.getSubjectName() != null ? exam.getSubjectName() : subjectId);
            subjectNamesFromExams.putIfAbsent(subjectId, subjectName);
            subjectMarksObtained.merge(subjectId, mark.getMarksObtained() != null ? mark.getMarksObtained() : 0.0, Double::sum);
            subjectMaxMarks.merge(subjectId, (double) exam.getMaxMarks(), Double::sum);
        }

        // Build subject grades — include all subjects that have marks
        List<ReportCard.SubjectGrade> subjectGrades = new ArrayList<>();
        double totalMarks = 0;
        double totalMaxMarks = 0;

        // Use subjects from exams (not all standard subjects — only show subjects with data)
        Map<String, String> subjectNames = subjectNamesFromExams.isEmpty() ? allSubjects : subjectNamesFromExams;

        for (String subjectId : subjectNames.keySet()) {
            double obtained = subjectMarksObtained.getOrDefault(subjectId, 0.0);
            double max = subjectMaxMarks.getOrDefault(subjectId, 0.0);
            double pct = max > 0 ? (obtained / max) * 100 : 0;
            String grade = calculateGrade(pct);

            // Skip subjects with no marks
            if (max <= 0) continue;

            ReportCard.SubjectGrade sg = new ReportCard.SubjectGrade();
            // Use proper name from allSubjects map, fallback to exam name
            sg.setSubjectName(allSubjects.getOrDefault(subjectId, subjectNames.get(subjectId)));
            sg.setMarksObtained(obtained);
            sg.setMaxMarks(max);
            sg.setGrade(grade);
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
        reportCard.setSubjects(subjectGrades);
        reportCard.setTotalMarks(totalMarks);
        reportCard.setTotalMaxMarks(totalMaxMarks);
        reportCard.setPercentage(Math.round(overallPercentage * 100.0) / 100.0);
        reportCard.setGrade(overallGrade);
        reportCard.setRank(rank);
        reportCard.setAttendancePercentage(Math.round(attendancePercentage * 100.0) / 100.0);

        ReportCard saved = reportCardRepository.save(reportCard);
        logger.info("Report card generated and saved for studentId={}, id={}", studentId, saved.getId());
        return saved;
    }

    public byte[] generateReportCardPdf(String reportCardId, String tenantId) {
        logger.info("Generating report card PDF for reportCardId={}, tenantId={}", reportCardId, tenantId);

        ReportCard reportCard = reportCardRepository.findById(reportCardId)
                .orElseThrow(() -> new ResourceNotFoundException("Report card not found with id: " + reportCardId));

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));

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

            addCompactInfoCell(infoTable, "Student Name:", reportCard.getStudentName());
            addCompactInfoCell(infoTable, "Class:", reportCard.getClassName());
            addCompactInfoCell(infoTable, "Section:", sectionName.isEmpty() ? "-" : sectionName);
            addCompactInfoCell(infoTable, "Adm. No:", student.getAdmissionNumber() != null ? student.getAdmissionNumber() : "-");
            addCompactInfoCell(infoTable, "Roll No:", student.getRollNumber() != null ? student.getRollNumber() : "-");
            addCompactInfoCell(infoTable, "Academic Year:", reportCard.getAcademicYearLabel() != null ? reportCard.getAcademicYearLabel() : reportCard.getAcademicYearId());
            addCompactInfoCell(infoTable, "DOB:", student.getDateOfBirth() != null ? student.getDateOfBirth().toString() : "-");
            addCompactInfoCell(infoTable, "Rank:", String.valueOf(reportCard.getRank()));
            document.add(infoTable);

            // ── Marks Table ──
            Table marksTable = new Table(UnitValue.createPercentArray(new float[]{8, 32, 20, 20, 20}));
            marksTable.setWidth(UnitValue.createPercentValue(100)).setMarginBottom(4);

            addCompactHeaderCell(marksTable, "#");
            addCompactHeaderCell(marksTable, "Subject");
            addCompactHeaderCell(marksTable, "Marks Obtained");
            addCompactHeaderCell(marksTable, "Max Marks");
            addCompactHeaderCell(marksTable, "Grade");

            List<ReportCard.SubjectGrade> subjects = reportCard.getSubjects();
            if (subjects != null) {
                for (int i = 0; i < subjects.size(); i++) {
                    ReportCard.SubjectGrade sg = subjects.get(i);
                    marksTable.addCell(new Cell().add(new Paragraph(String.valueOf(i + 1)).setFontSize(8)).setPadding(2));
                    marksTable.addCell(new Cell().add(new Paragraph(sg.getSubjectName()).setFontSize(8)).setPadding(2));
                    marksTable.addCell(new Cell().add(new Paragraph(String.valueOf(sg.getMarksObtained())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
                    marksTable.addCell(new Cell().add(new Paragraph(String.valueOf(sg.getMaxMarks())).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
                    marksTable.addCell(new Cell().add(new Paragraph(sg.getGrade()).setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
                }
            }

            // Total row
            marksTable.addCell(new Cell(1, 2).add(new Paragraph("TOTAL").setBold().setFontSize(8)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(String.valueOf(reportCard.getTotalMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
            marksTable.addCell(new Cell().add(new Paragraph(String.valueOf(reportCard.getTotalMaxMarks())).setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)).setPadding(2));
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
            String result = reportCard.getPercentage() >= 35 ? "PASS" : "FAIL";
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

    public List<ReportCard> generateBulkReportCards(String classId, String academicYearId) {
        logger.info("Generating bulk report cards for classId={}, academicYearId={}", classId, academicYearId);

        List<Student> students = studentRepository.findByClassIdAndDeletedAtIsNull(classId, Pageable.unpaged()).getContent();
        List<ReportCard> reportCards = new ArrayList<>();

        for (Student student : students) {
            try {
                ReportCard rc = generateReportCard(student.getStudentId(), academicYearId);
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

    private String calculateGrade(double percentage) {
        if (percentage >= 90) return "A+";
        if (percentage >= 80) return "A";
        if (percentage >= 70) return "B+";
        if (percentage >= 60) return "B";
        if (percentage >= 50) return "C";
        if (percentage >= 40) return "D";
        return "F";
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
}
