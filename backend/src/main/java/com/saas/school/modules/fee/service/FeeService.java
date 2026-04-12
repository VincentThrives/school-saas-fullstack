package com.saas.school.modules.fee.service;
import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.modules.fee.model.*;
import com.saas.school.modules.fee.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate; import java.util.*; 
@Service
public class FeeService {
    @Autowired private FeeStructureRepository structureRepo;
    @Autowired private FeePaymentRepository paymentRepo;
    @Autowired private AuditService auditService;

    public FeeStructure createStructure(FeeStructure req) {
        req.setFeeStructureId(UUID.randomUUID().toString());
        return structureRepo.save(req);
    }

    public List<FeeStructure> listStructures(String academicYearId, String classId) {
        return classId != null
            ? structureRepo.findByAcademicYearIdAndClassId(academicYearId, classId)
            : structureRepo.findByAcademicYearId(academicYearId);
    }

    public FeePayment recordPayment(FeePayment req, String recordedBy) {
        req.setPaymentId(UUID.randomUUID().toString());
        req.setReceiptNumber(generateReceiptNumber());
        req.setRecordedBy(recordedBy);
        if (req.getPaymentDate() == null) req.setPaymentDate(LocalDate.now());
        FeePayment saved = paymentRepo.save(req);
        auditService.log("RECORD_PAYMENT","FeePayment",saved.getPaymentId(),
            "Payment recorded for student "+req.getStudentId()+": "+req.getAmountPaid());
        return saved;
    }

    public List<FeePayment> getStudentPayments(String studentId) {
        return paymentRepo.findByStudentId(studentId);
    }

    private String generateReceiptNumber() {
        return "RCP-" + LocalDate.now().getYear() + "-" + String.format("%06d", (long)(Math.random()*1000000));
    }
}