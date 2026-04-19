package com.saas.school.modules.fee.dto;

public class VoidPaymentRequest {
    private String reason;

    public VoidPaymentRequest() {}

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
