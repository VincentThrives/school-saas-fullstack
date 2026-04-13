package com.saas.school.modules.idcard.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import javax.imageio.ImageIO;

@Service
public class IdCardService {

    private static final Logger logger = LoggerFactory.getLogger(IdCardService.class);

    private static final float CARD_WIDTH = 85.6f * 72 / 25.4f;  // 85.6mm in points
    private static final float CARD_HEIGHT = 53.98f * 72 / 25.4f; // 53.98mm in points

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TenantRepository tenantRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    public byte[] generateStudentIdCard(String studentId, String tenantId) {
        logger.info("Generating student ID card for studentId={}, tenantId={}", studentId, tenantId);

        Student student = studentRepository.findById(studentId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));

        // Get student name from student directly or from user
        String studentName = student.getFirstName() != null ? student.getFirstName() + " " + (student.getLastName() != null ? student.getLastName() : "") : "Student";
        if (studentName.equals("Student") && student.getUserId() != null) {
            User user = userRepository.findById(student.getUserId()).orElse(null);
            if (user != null) studentName = user.getFirstName() + " " + user.getLastName();
        }

        // Lookup tenant in central DB
        String currentTenantCtx = com.saas.school.config.mongodb.TenantContext.getTenantId();
        com.saas.school.config.mongodb.TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));
        if (currentTenantCtx != null) com.saas.school.config.mongodb.TenantContext.setTenantId(currentTenantCtx);

        String className = "";
        if (student.getClassId() != null) {
            SchoolClass schoolClass = schoolClassRepository.findById(student.getClassId()).orElse(null);
            if (schoolClass != null) {
                className = schoolClass.getName();
            }
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            PageSize cardSize = new PageSize(CARD_WIDTH, CARD_HEIGHT);
            pdfDoc.setDefaultPageSize(cardSize);
            Document document = new Document(pdfDoc);
            document.setMargins(5, 8, 5, 8);

            addStudentCardContent(document, student, user, tenant, className);

            document.close();
            logger.info("Student ID card generated successfully for studentId={}", studentId);
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating student ID card for studentId={}: {}", studentId, e.getMessage(), e);
            throw new RuntimeException("Failed to generate student ID card", e);
        }
    }

    public byte[] generateTeacherIdCard(String teacherId, String tenantId) {
        logger.info("Generating teacher ID card for teacherId={}, tenantId={}", teacherId, tenantId);

        Teacher teacher = teacherRepository.findById(teacherId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));

        String teacherName = teacher.getFirstName() != null ? teacher.getFirstName() + " " + (teacher.getLastName() != null ? teacher.getLastName() : "") : "Teacher";
        if (teacherName.equals("Teacher") && teacher.getUserId() != null) {
            User user = userRepository.findById(teacher.getUserId()).orElse(null);
            if (user != null) teacherName = user.getFirstName() + " " + user.getLastName();
        }

        // Lookup tenant in central DB
        String currentTenantCtx = com.saas.school.config.mongodb.TenantContext.getTenantId();
        com.saas.school.config.mongodb.TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));
        if (currentTenantCtx != null) com.saas.school.config.mongodb.TenantContext.setTenantId(currentTenantCtx);

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            PageSize cardSize = new PageSize(CARD_WIDTH, CARD_HEIGHT);
            pdfDoc.setDefaultPageSize(cardSize);
            Document document = new Document(pdfDoc);
            document.setMargins(5, 8, 5, 8);

            addTeacherCardContent(document, teacher, user, tenant);

            document.close();
            logger.info("Teacher ID card generated successfully for teacherId={}", teacherId);
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating teacher ID card for teacherId={}: {}", teacherId, e.getMessage(), e);
            throw new RuntimeException("Failed to generate teacher ID card", e);
        }
    }

    public byte[] generateBulkStudentIdCards(List<String> studentIds, String tenantId) {
        logger.info("Generating bulk student ID cards for {} students, tenantId={}", studentIds.size(), tenantId);

        // Lookup tenant in central DB
        String currentTenantCtx = com.saas.school.config.mongodb.TenantContext.getTenantId();
        com.saas.school.config.mongodb.TenantContext.clear();
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + tenantId));
        if (currentTenantCtx != null) com.saas.school.config.mongodb.TenantContext.setTenantId(currentTenantCtx);

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            pdfDoc.setDefaultPageSize(PageSize.A4);
            Document document = new Document(pdfDoc);
            document.setMargins(20, 20, 20, 20);

            float tableWidth = PageSize.A4.getWidth() - 40;
            Table pageTable = new Table(UnitValue.createPercentArray(new float[]{1, 1}));
            pageTable.setWidth(UnitValue.createPointValue(tableWidth));

            for (int i = 0; i < studentIds.size(); i++) {
                String sid = studentIds.get(i);
                try {
                    Student student = studentRepository.findByStudentIdAndDeletedAtIsNull(sid).orElse(null);
                    if (student == null) {
                        logger.warn("Student not found for bulk ID card: {}", sid);
                        continue;
                    }

                    User user = userRepository.findById(student.getUserId()).orElse(null);
                    if (user == null) {
                        logger.warn("User not found for student: {}", sid);
                        continue;
                    }

                    String className = "";
                    if (student.getClassId() != null) {
                        SchoolClass schoolClass = schoolClassRepository.findById(student.getClassId()).orElse(null);
                        if (schoolClass != null) {
                            className = schoolClass.getName();
                        }
                    }

                    Cell cardCell = new Cell();
                    cardCell.setBorder(new SolidBorder(ColorConstants.GRAY, 0.5f));
                    cardCell.setPadding(5);
                    cardCell.setMinHeight(CARD_HEIGHT);
                    cardCell.setWidth(UnitValue.createPointValue(CARD_WIDTH));

                    cardCell.add(new Paragraph(tenant.getSchoolName())
                            .setBold().setFontSize(7).setTextAlignment(TextAlignment.CENTER));
                    cardCell.add(new Paragraph("STUDENT IDENTITY CARD")
                            .setFontSize(5).setTextAlignment(TextAlignment.CENTER)
                            .setFontColor(ColorConstants.DARK_GRAY));

                    String fullName = user.getFirstName() + " " + user.getLastName();
                    cardCell.add(new Paragraph("Name: " + fullName).setFontSize(5));
                    cardCell.add(new Paragraph("Adm No: " + (student.getAdmissionNumber() != null ? student.getAdmissionNumber() : "N/A")).setFontSize(5));
                    cardCell.add(new Paragraph("Class: " + className).setFontSize(5));

                    pageTable.addCell(cardCell);
                } catch (Exception e) {
                    logger.error("Error generating card for student {}: {}", sid, e.getMessage());
                }
            }

            // Fill remaining cell if odd number
            if (studentIds.size() % 2 != 0) {
                Cell emptyCell = new Cell();
                emptyCell.setBorder(Border.NO_BORDER);
                pageTable.addCell(emptyCell);
            }

            document.add(pageTable);
            document.close();
            logger.info("Bulk student ID cards generated successfully for {} students", studentIds.size());
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Error generating bulk student ID cards: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to generate bulk student ID cards", e);
        }
    }

    private void addStudentCardContent(Document document, Student student, User user, Tenant tenant, String className) throws WriterException, IOException {
        String schoolName = tenant.getSchoolName();
        String fullName = user.getFirstName() + " " + user.getLastName();

        document.add(new Paragraph(schoolName)
                .setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(1));

        document.add(new Paragraph("STUDENT IDENTITY CARD")
                .setFontSize(6).setTextAlignment(TextAlignment.CENTER)
                .setFontColor(ColorConstants.DARK_GRAY)
                .setMarginBottom(3));

        Table contentTable = new Table(UnitValue.createPercentArray(new float[]{60, 40}));
        contentTable.setWidth(UnitValue.createPercentValue(100));

        // Left side: student info
        Cell infoCell = new Cell();
        infoCell.setBorder(Border.NO_BORDER);
        infoCell.add(new Paragraph("Name: " + fullName).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Adm No: " + (student.getAdmissionNumber() != null ? student.getAdmissionNumber() : "N/A")).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Class: " + className).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("DOB: " + (student.getDateOfBirth() != null ? student.getDateOfBirth().toString() : "N/A")).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Blood Group: " + (student.getBloodGroup() != null ? student.getBloodGroup() : "N/A")).setFontSize(6));
        contentTable.addCell(infoCell);

        // Right side: photo placeholder + QR code
        Cell rightCell = new Cell();
        rightCell.setBorder(Border.NO_BORDER);
        rightCell.setTextAlignment(TextAlignment.CENTER);

        // Photo placeholder
        Table photoPlaceholder = new Table(1);
        photoPlaceholder.setWidth(UnitValue.createPointValue(40));
        Cell photoCell = new Cell();
        photoCell.setHeight(45);
        photoCell.setBorder(new SolidBorder(ColorConstants.GRAY, 0.5f));
        photoCell.add(new Paragraph("PHOTO").setFontSize(5).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.GRAY));
        photoPlaceholder.addCell(photoCell);
        rightCell.add(photoPlaceholder);

        // QR Code
        String qrData = "{\"type\":\"STUDENT\",\"id\":\"" + student.getStudentId() + "\",\"school\":\"" + schoolName + "\"}";
        Image qrImage = generateQrCodeImage(qrData, 45, 45);
        qrImage.setHorizontalAlignment(HorizontalAlignment.CENTER);
        rightCell.add(qrImage);

        contentTable.addCell(rightCell);
        document.add(contentTable);
    }

    private void addTeacherCardContent(Document document, Teacher teacher, User user, Tenant tenant) throws WriterException, IOException {
        String schoolName = tenant.getSchoolName();
        String fullName = user.getFirstName() + " " + user.getLastName();

        document.add(new Paragraph(schoolName)
                .setBold().setFontSize(8).setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(1));

        document.add(new Paragraph("TEACHER IDENTITY CARD")
                .setFontSize(6).setTextAlignment(TextAlignment.CENTER)
                .setFontColor(ColorConstants.DARK_GRAY)
                .setMarginBottom(3));

        Table contentTable = new Table(UnitValue.createPercentArray(new float[]{60, 40}));
        contentTable.setWidth(UnitValue.createPercentValue(100));

        // Left side: teacher info
        Cell infoCell = new Cell();
        infoCell.setBorder(Border.NO_BORDER);
        infoCell.add(new Paragraph("Name: " + fullName).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Employee ID: " + (teacher.getEmployeeId() != null ? teacher.getEmployeeId() : "N/A")).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Qualification: " + (teacher.getQualification() != null ? teacher.getQualification() : "N/A")).setFontSize(6).setMarginBottom(1));
        infoCell.add(new Paragraph("Department: " + (teacher.getSpecialization() != null ? teacher.getSpecialization() : "N/A")).setFontSize(6));
        contentTable.addCell(infoCell);

        // Right side: photo placeholder + QR code
        Cell rightCell = new Cell();
        rightCell.setBorder(Border.NO_BORDER);
        rightCell.setTextAlignment(TextAlignment.CENTER);

        Table photoPlaceholder = new Table(1);
        photoPlaceholder.setWidth(UnitValue.createPointValue(40));
        Cell photoCell = new Cell();
        photoCell.setHeight(45);
        photoCell.setBorder(new SolidBorder(ColorConstants.GRAY, 0.5f));
        photoCell.add(new Paragraph("PHOTO").setFontSize(5).setTextAlignment(TextAlignment.CENTER).setFontColor(ColorConstants.GRAY));
        photoPlaceholder.addCell(photoCell);
        rightCell.add(photoPlaceholder);

        String qrData = "{\"type\":\"TEACHER\",\"id\":\"" + teacher.getTeacherId() + "\",\"school\":\"" + schoolName + "\"}";
        Image qrImage = generateQrCodeImage(qrData, 45, 45);
        qrImage.setHorizontalAlignment(HorizontalAlignment.CENTER);
        rightCell.add(qrImage);

        contentTable.addCell(rightCell);
        document.add(contentTable);
    }

    private Image generateQrCodeImage(String data, int width, int height) throws WriterException, IOException {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(data, BarcodeFormat.QR_CODE, width, height);
        BufferedImage bufferedImage = MatrixToImageWriter.toBufferedImage(bitMatrix);

        ByteArrayOutputStream imgBaos = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, "PNG", imgBaos);
        byte[] imageBytes = imgBaos.toByteArray();

        return new Image(ImageDataFactory.create(imageBytes));
    }
}
