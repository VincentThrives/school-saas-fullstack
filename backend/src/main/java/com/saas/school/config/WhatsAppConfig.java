package com.saas.school.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class WhatsAppConfig {

    @Value("${app.whatsapp.phone-number-id}")
    private String phoneNumberId;

    @Value("${app.whatsapp.access-token}")
    private String accessToken;

    @Value("${app.whatsapp.api-version}")
    private String apiVersion;

    @Value("${app.whatsapp.api-base-url}")
    private String apiBaseUrl;

    @Bean
    public RestClient whatsAppRestClient() {
        return RestClient.builder()
                .baseUrl(apiBaseUrl)
                .defaultHeader("Authorization", "Bearer " + accessToken)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    public String getPhoneNumberId() { return phoneNumberId; }
    public String getApiVersion() { return apiVersion; }
}
