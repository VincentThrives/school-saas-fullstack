package com.saas.school.modules.fee.model;
import lombok.*; import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.*; 
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Document(collection = "fee_payments")
public class FeePayment {
    @Id private String paymentId;
    private String receiptNumber, studentId, classId, feeStructureId;
    private double amountPaid;
    private LocalDate paymentDate;
    private PaymentMode paymentMode;
    private String remarks, recordedBy;
    @CreatedDate private Instant createdAt;
    public enum PaymentMode { CASH, ONLINE, CHEQUE, DD, OTHER }
}