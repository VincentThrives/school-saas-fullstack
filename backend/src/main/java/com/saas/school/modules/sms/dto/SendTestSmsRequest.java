package com.saas.school.modules.sms.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for {@code POST /api/v1/sms/test}. Lets the school admin
 * fire a sample Absence Alert against their own phone to verify
 * the SMS pipeline before going live with real parents.
 *
 * Rate-limited to 10 tests/hour per admin to prevent abuse — the
 * tests cost real money out of the platform wallet.
 */
public class SendTestSmsRequest {

    /** 10-digit Indian mobile, with or without +91 prefix.
     *  PhoneNumberService normalises before sending. */
    @NotBlank(message = "Phone number is required")
    private String phone;

    public SendTestSmsRequest() {}

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
