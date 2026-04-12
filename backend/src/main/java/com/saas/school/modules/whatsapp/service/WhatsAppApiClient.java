package com.saas.school.modules.whatsapp.service;

import com.saas.school.config.WhatsAppConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class WhatsAppApiClient {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppApiClient.class);

    @Autowired
    private RestClient whatsAppRestClient;

    @Autowired
    private WhatsAppConfig whatsAppConfig;

    @SuppressWarnings("unchecked")
    public String sendTextMessage(String toPhone, String body) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("messaging_product", "whatsapp");
            payload.put("to", toPhone);
            payload.put("type", "text");
            payload.put("text", Map.of("body", body));

            String uri = "/" + whatsAppConfig.getApiVersion() + "/" + whatsAppConfig.getPhoneNumberId() + "/messages";

            Map<String, Object> response = whatsAppRestClient.post()
                    .uri(uri)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> messages = (List<Map<String, String>>) response.get("messages");
            return messages.get(0).get("id");
        } catch (Exception e) {
            logger.error("Failed to send WhatsApp text message to {}: {}", toPhone, e.getMessage());
            throw new RuntimeException("Failed to send WhatsApp message: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    public String sendMediaMessage(String toPhone, String mediaUrl, String mimeType, String filename, String caption) {
        try {
            String type = mimeType.startsWith("image/") ? "image" : "document";

            Map<String, Object> mediaContent = new HashMap<>();
            mediaContent.put("link", mediaUrl);
            if (caption != null && !caption.isBlank()) {
                mediaContent.put("caption", caption);
            }
            if ("document".equals(type) && filename != null) {
                mediaContent.put("filename", filename);
            }

            Map<String, Object> payload = new HashMap<>();
            payload.put("messaging_product", "whatsapp");
            payload.put("to", toPhone);
            payload.put("type", type);
            payload.put(type, mediaContent);

            String uri = "/" + whatsAppConfig.getApiVersion() + "/" + whatsAppConfig.getPhoneNumberId() + "/messages";

            Map<String, Object> response = whatsAppRestClient.post()
                    .uri(uri)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);

            List<Map<String, String>> messages = (List<Map<String, String>>) response.get("messages");
            return messages.get(0).get("id");
        } catch (Exception e) {
            logger.error("Failed to send WhatsApp media message to {}: {}", toPhone, e.getMessage());
            throw new RuntimeException("Failed to send WhatsApp media message: " + e.getMessage(), e);
        }
    }
}
