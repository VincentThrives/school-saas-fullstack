package com.saas.school.modules.notification.service;

import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.model.NotificationFireLog;
import com.saas.school.modules.notification.model.NotificationRule;
import com.saas.school.modules.notification.model.NotificationTemplate;
import com.saas.school.modules.notification.repository.NotificationFireLogRepository;
import com.saas.school.modules.notification.repository.NotificationRuleRepository;
import com.saas.school.modules.notification.repository.NotificationTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Single entry point for every automatic notification trigger.
 *
 *   ruleEngine.fire("ABSENCE_ALERT", Map.of("studentId", id, "date", "2026-04-18"),
 *                   FirePayload.of(List.of(parentId1, parentId2)));
 *
 * Handles:
 *  - rule lookup + enabled check
 *  - idempotency via (ruleKey, entityId, dateKey) log
 *  - template rendering (literal if no template linked)
 *  - channel routing
 *  - actual send via NotificationService
 *  - updates rule.lastFiredAt
 */
@Service
public class NotificationRuleEngine {

    private static final Logger log = LoggerFactory.getLogger(NotificationRuleEngine.class);
    private static final Pattern VAR = Pattern.compile("\\{([a-zA-Z0-9_]+)\\}");

    @Autowired private NotificationRuleRepository ruleRepository;
    @Autowired private NotificationTemplateRepository templateRepository;
    @Autowired private NotificationFireLogRepository fireLogRepository;
    @Autowired private NotificationService notificationService;

    /**
     * Fire a rule.  No-op if the rule is disabled or already fired for this
     * (entityId, dateKey). Catches & logs any exception so failures don't
     * break the calling domain operation.
     */
    public void fire(String ruleKey, FirePayload payload) {
        try {
            NotificationRule rule = ruleRepository.findByRuleKey(ruleKey).orElse(null);
            if (rule == null) {
                log.debug("No rule configured for {}", ruleKey);
                return;
            }
            if (!rule.isEnabled()) {
                log.debug("Rule {} is disabled — skipping", ruleKey);
                return;
            }

            // Idempotency guard — one fire per (ruleKey, entityId, dateKey).
            String entityId = payload.entityId != null ? payload.entityId : UUID.randomUUID().toString();
            String dateKey = payload.dateKey != null ? payload.dateKey : LocalDate.now().toString();
            if (fireLogRepository.existsByRuleKeyAndEntityIdAndDateKey(ruleKey, entityId, dateKey)) {
                log.debug("Rule {} already fired for {}/{} — skipping", ruleKey, entityId, dateKey);
                return;
            }

            // Resolve title/body — from linked template or built-in fallback.
            String title = payload.fallbackTitle;
            String body = payload.fallbackBody;
            if (rule.getTemplateId() != null && !rule.getTemplateId().isBlank()) {
                Optional<NotificationTemplate> tpl = templateRepository.findById(rule.getTemplateId());
                if (tpl.isPresent()) {
                    title = render(tpl.get().getTitle(), payload.vars);
                    body = render(tpl.get().getBody(), payload.vars);
                }
            } else {
                title = render(title, payload.vars);
                body = render(body, payload.vars);
            }

            // Build & send notification.
            Notification n = new Notification();
            n.setTitle(title);
            n.setBody(body);
            n.setType(payload.type != null ? payload.type : Notification.NotificationType.GENERAL);
            n.setChannel(parseChannel(rule.getChannel()));
            n.setRecipientType(payload.recipientType != null ? payload.recipientType : Notification.RecipientType.INDIVIDUAL);
            if (payload.recipientType == Notification.RecipientType.ROLE) {
                n.setRecipientRole(payload.recipientRole);
            }
            if (payload.recipientType == Notification.RecipientType.CLASS) {
                n.setRecipientClassId(payload.recipientClassId);
            }
            if (payload.recipientIds != null) {
                n.setRecipientIds(new ArrayList<>(payload.recipientIds));
            }
            notificationService.send(n, "SYSTEM");

            // Mark fired + bump rule timestamp.
            fireLogRepository.save(new NotificationFireLog(ruleKey, entityId, dateKey));
            rule.setLastFiredAt(Instant.now());
            ruleRepository.save(rule);
        } catch (Exception e) {
            log.error("Rule engine failure for {}: {}", ruleKey, e.getMessage(), e);
        }
    }

    private Notification.Channel parseChannel(String s) {
        if (s == null) return Notification.Channel.IN_APP;
        try { return Notification.Channel.valueOf(s); }
        catch (Exception e) { return Notification.Channel.IN_APP; }
    }

    /** Replace {name} placeholders with payload values. Missing keys stay literal. */
    private String render(String tpl, Map<String, Object> vars) {
        if (tpl == null) return "";
        if (vars == null || vars.isEmpty()) return tpl;
        Matcher m = VAR.matcher(tpl);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            Object v = vars.get(m.group(1));
            m.appendReplacement(out, Matcher.quoteReplacement(v == null ? m.group(0) : String.valueOf(v)));
        }
        m.appendTail(out);
        return out.toString();
    }

    // ── DTO ────────────────────────────────────────────────────

    public static class FirePayload {
        public Notification.NotificationType type;
        public Notification.RecipientType recipientType;
        public String recipientRole;
        public String recipientClassId;
        public List<String> recipientIds;
        public String entityId;           // for idempotency, e.g. attendance record id
        public String dateKey;            // e.g. "2026-04-18"; defaults to today
        public Map<String, Object> vars = Collections.emptyMap();
        public String fallbackTitle;      // used when no template linked
        public String fallbackBody;

        public static FirePayload toIndividuals(List<String> userIds) {
            FirePayload p = new FirePayload();
            p.recipientType = Notification.RecipientType.INDIVIDUAL;
            p.recipientIds = userIds;
            return p;
        }
        public static FirePayload toRole(String role) {
            FirePayload p = new FirePayload();
            p.recipientType = Notification.RecipientType.ROLE;
            p.recipientRole = role;
            return p;
        }
        public static FirePayload toClass(String classId) {
            FirePayload p = new FirePayload();
            p.recipientType = Notification.RecipientType.CLASS;
            p.recipientClassId = classId;
            return p;
        }
        public static FirePayload toAll() {
            FirePayload p = new FirePayload();
            p.recipientType = Notification.RecipientType.ALL;
            return p;
        }

        public FirePayload entityId(String id)  { this.entityId = id; return this; }
        public FirePayload dateKey(String k)    { this.dateKey = k; return this; }
        public FirePayload type(Notification.NotificationType t) { this.type = t; return this; }
        public FirePayload vars(Map<String, Object> v) { this.vars = v; return this; }
        public FirePayload fallback(String title, String body) {
            this.fallbackTitle = title; this.fallbackBody = body; return this;
        }
    }
}
