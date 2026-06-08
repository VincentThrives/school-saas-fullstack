package com.saas.school.modules.sms.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.context.annotation.Bean;

import java.util.HashMap;
import java.util.Map;

/**
 * SMS module configuration. Reads from application.yml under {@code sms:*}
 * and from environment variables on Render. Designed so an admin can
 * toggle the entire SMS feature with a single env var ({@code SMS_ENABLED})
 * without rebuilding.
 *
 * Environment variable contract (Render):
 *   SMS_ENABLED              — global kill switch ("true"/"false")
 *   MSG91_AUTH_KEY           — gateway credential (secret)
 *   MSG91_SENDER_ID          — DLT-approved header (default: VTPLS)
 *   MSG91_BASE_URL           — REST API root (default: api.msg91.com/v5)
 *   MSG91_TPL_ABSENCE_ALERT  — DLT template id (paste-in once approved)
 *   MSG91_TPL_RESULT_COMBINED
 *   MSG91_TPL_RESULT_SINGLE
 *   MSG91_TPL_CUSTOM_NOTICE
 *
 * Cost per SMS is hard-coded at 0.25 INR — the MSG91 rate negotiated
 * for our current send volume. Update once you hit a different tier
 * (volume discounts kick in past 1 lakh/month).
 */
@Configuration
public class SmsConfig {

    /** Hard global switch — when false, SmsService is a no-op. */
    @Value("${sms.enabled:true}")
    private boolean enabled;

    @Value("${sms.msg91.auth-key:}")
    private String msg91AuthKey;

    @Value("${sms.msg91.sender-id:VTPLS}")
    private String msg91SenderId;

    @Value("${sms.msg91.base-url:https://api.msg91.com/api/v5}")
    private String msg91BaseUrl;

    @Value("${sms.msg91.templates.absence-alert:}")
    private String tplAbsenceAlert;

    @Value("${sms.msg91.templates.result-combined:}")
    private String tplResultCombined;

    @Value("${sms.msg91.templates.result-single:}")
    private String tplResultSingle;

    @Value("${sms.msg91.templates.custom-notice:}")
    private String tplCustomNotice;

    @Value("${sms.cost-per-sms-inr:0.25}")
    private double costPerSmsInr;

    @Value("${sms.retry.max-attempts:3}")
    private int retryMaxAttempts;

    @Value("${sms.retry.backoff-ms:1000}")
    private long retryBackoffMs;

    /** Used by Msg91SmsProvider — kept here so the bean is shared. */
    @Bean(name = "smsRestTemplate")
    public RestTemplate smsRestTemplate() {
        return new RestTemplate();
    }

    /** Lookup table the SmsService uses to pick the right template id. */
    public Map<String, String> templateMap() {
        Map<String, String> m = new HashMap<>();
        m.put("ABSENCE_ALERT",   tplAbsenceAlert);
        m.put("RESULT_COMBINED", tplResultCombined);
        m.put("RESULT_SINGLE",   tplResultSingle);
        m.put("CUSTOM_NOTICE",   tplCustomNotice);
        return m;
    }

    /** Whether all minimum config is in place to actually send an SMS.
     *  SmsService falls back to a "skipped — missing config" audit row
     *  if this is false at send time. */
    public boolean isFullyConfigured() {
        return enabled
                && msg91AuthKey != null && !msg91AuthKey.isBlank()
                && msg91SenderId != null && !msg91SenderId.isBlank();
    }

    // ── Getters ────────────────────────────────────────────────

    public boolean isEnabled() { return enabled; }
    public String getMsg91AuthKey() { return msg91AuthKey; }
    public String getMsg91SenderId() { return msg91SenderId; }
    public String getMsg91BaseUrl() { return msg91BaseUrl; }
    public String getTplAbsenceAlert() { return tplAbsenceAlert; }
    public String getTplResultCombined() { return tplResultCombined; }
    public String getTplResultSingle() { return tplResultSingle; }
    public String getTplCustomNotice() { return tplCustomNotice; }
    public double getCostPerSmsInr() { return costPerSmsInr; }
    public int getRetryMaxAttempts() { return retryMaxAttempts; }
    public long getRetryBackoffMs() { return retryBackoffMs; }
}
