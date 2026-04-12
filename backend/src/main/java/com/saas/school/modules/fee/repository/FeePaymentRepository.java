package com.saas.school.modules.fee.repository;
import com.saas.school.modules.fee.model.FeePayment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate; import java.util.List;
public interface FeePaymentRepository extends MongoRepository<FeePayment, String> {
    List<FeePayment> findByStudentId(String studentId);
    List<FeePayment> findByPaymentDateBetween(LocalDate from, LocalDate to);
    boolean existsByReceiptNumber(String receiptNumber);
}