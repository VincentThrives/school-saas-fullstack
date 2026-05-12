package com.saas.school.modules.sms.service;

import com.saas.school.modules.sms.config.SmsConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Sends SMS through MSG91's Flow API v5.
 *
 * Endpoint:  POST {base-url}/flow/
 * Auth:      authkey header
 * Body:      JSON with template_id, sender, short_url (false), recipients[]
 *
 * MSG91 returns:
 *   - 200 OK with body { type: "success", message: "<messageId>" } on accept
 *   - 200 OK with body { type: "error",   message: "<reason>" } on reject
 *     (yes — they return 200 even on rejection, the body tells the truth)
 *   - 4xx/5xx for actual HTTP problems
 *
 * If {@link SmsConfig#isFullyConfigured()} is false (e.g. auth key not
 * set on Render yet), this provider returns a synthetic "DRY_RUN"
 * success without making any HTTP call. That lets us deploy the SMS
 * module to prod before the auth key arrives — flip the env var
 * tomorrow and real SMS starts flowing.
 */
@Service
public class Msg91SmsProvider implements SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(Msg91SmsProvider.class);

    @Autowired private SmsConfig smsConfig;

    @Autowired
    @Qualifier("smsRestTemplate")
    private RestTemplate rest;

    @Override
    public SendResult send(SendArgs args) {
        // Dry-run mode — auth key not configured (yet). Pretend it worked
        // so the rest of the pipeline (audit log, frontend) can be
        // exercised end-to-end before the real key arrives.
        if (!smsConfig.isFullyConfigured()) {
            log.info("[SMS DRY-RUN] Would send to {} via template {} — auth key not configured",
                    args.recipientPhone(), args.templateId());
            return SendResult.ok("DRY-RUN-" + UUID.randomUUID());
        }

        String url = smsConfig.getMsg91BaseUrl() + "/flow/";

        // Build the MSG91 v5 Flow body. The "recipients" array carries
        // one entry per phone with variables inlined; we always send to
        // one phone per call (SmsService fans out across phones), so
        // this array has exactly one item.
        Map<String, Object> recipient = new HashMap<>();
        // MSG91 expects the phone in "mobiles" field WITHOUT the leading "+".
        recipient.put("mobiles", args.recipientPhone().replace("+", ""));
        // Stamp each variable BOTH as lowercase (the convention STPL uses)
        // AND as uppercase. MSG91's Flow API matches variable keys against
        // whatever names the imported template was registered with — which
        // varies wildly between accounts (some show as VAR1/VAR2/VAR3 in
        // the UI, others as var1/var2/var3, others with custom names like
        // NAME/SCHOOL/DATE). Sending both cases guarantees a match against
        // the common default conventions without making the admin reconfigure
        // the template. Duplicate keys with the same value are harmless —
        // MSG91 picks whichever its template references and ignores the rest.
        if (args.variables() != null) {
            args.variables().forEach((k, v) -> {
                recipient.put(k, v);                              // var1
                recipient.put(k.toUpperCase(java.util.Locale.ROOT), v);  // VAR1
            });
        }

        Map<String, Object> body = new HashMap<>();
        body.put("template_id", args.templateId());
        body.put("sender", args.senderId());
        body.put("short_url", "0");  // we don't want MSG91 url-shortening our content
        body.put("recipients", List.of(recipient));

        // ALSO stamp every variable at the TOP LEVEL of the body. MSG91's
        // v5 Flow API honours variables either inside each recipient object
        // (per-recipient override) OR at the top level (default for all
        // recipients). Some templates only substitute when the keys appear
        // at the top level. We send both — duplicate keys with the same
        // value are harmless and MSG91 picks whichever position its
        // template references.
        if (args.variables() != null) {
            args.variables().forEach((k, v) -> {
                body.put(k, v);
                body.put(k.toUpperCase(java.util.Locale.ROOT), v);
            });
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("authkey", smsConfig.getMsg91AuthKey());
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        // INFO-level dump of the outgoing payload so the operator can see
        // exactly what keys we sent when MSG91 substitutes nothing. Auth
        // key never appears here — it goes in the header. Variable values
        // ARE in the payload (student name, school name, date) — sensitive
        // to the school but not to credentials, so logging at INFO is OK
        // for diagnostics during rollout. Drop to DEBUG once the variable
        // names are known to match the template.
        log.info("MSG91 send → url={} template_id={} sender={} recipient={} payloadKeys={}",
                url, args.templateId(), args.senderId(),
                args.recipientPhone(), body.keySet());

        try {
            ResponseEntity<Map> resp = rest.postForEntity(url, request, Map.class);
            return parseMsg91Response(resp.getBody(), args);
        } catch (HttpStatusCodeException e) {
            // 4xx/5xx HTTP error — e.g. auth key wrong, rate-limited, MSG91 down
            log.warn("MSG91 HTTP {} for {}: {}",
                    e.getStatusCode(), args.recipientPhone(), e.getResponseBodyAsString());
            return SendResult.fail("HTTP_" + e.getStatusCode().value(),
                    truncate(e.getResponseBodyAsString(), 200));
        } catch (Exception e) {
            log.error("MSG91 send threw for {}: {}", args.recipientPhone(), e.getMessage());
            return SendResult.fail("EXCEPTION", truncate(e.getMessage(), 200));
        }
    }

    /**
     * MSG91 returns 200 OK even on rejection — must inspect the JSON body
     * to know if the send actually succeeded.
     *
     *   { "type": "success", "message": "<requestId>" }   ← accepted
     *   { "type": "error",   "message": "<reason>" }      ← rejected
     */
    @SuppressWarnings("rawtypes")
    private SendResult parseMsg91Response(Map body, SendArgs args) {
        if (body == null) {
            return SendResult.fail("EMPTY_BODY", "MSG91 returned empty body");
        }
        Object type = body.get("type");
        Object message = body.get("message");

        if ("success".equals(type)) {
            String messageId = message == null ? "unknown" : message.toString();
            return SendResult.ok(messageId);
        }
        // "error" or anything else
        String reason = message == null ? "Unknown MSG91 error" : message.toString();
        log.warn("MSG91 rejected SMS to {}: {}", args.recipientPhone(), reason);
        return SendResult.fail("MSG91_REJECTED", reason);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
