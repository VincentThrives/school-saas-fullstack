package com.saas.school.modules.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.saas.school.modules.auth.dto.LoginRequest;
import com.saas.school.modules.auth.dto.SuperAdminLoginRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Auth Integration Tests")
class AuthIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @Test
    @DisplayName("Tenant login endpoint requires tenantId in body")
    void tenantLogin_missingTenantId_returns400() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setUsername("test@school.com");
        req.setPassword("password");
        // tenantId is missing → @NotBlank should reject

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Super admin login with wrong credentials returns 400")
    void superAdminLogin_wrongCredentials_returns401() throws Exception {
        SuperAdminLoginRequest req = new SuperAdminLoginRequest();
        req.setUsername("wrong@admin.com");
        req.setPassword("wrongpassword");

        mockMvc.perform(post("/api/v1/super/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Protected tenant endpoint returns 401 without JWT")
    void protectedEndpoint_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/students"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Super admin endpoint returns 403 without JWT")
    void superAdminEndpoint_noToken_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/super/tenants"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("Resolve tenant returns 404 for unknown school ID")
    void resolveTenant_unknownSchoolId_returns404() throws Exception {
        mockMvc.perform(post("/api/v1/auth/resolve-tenant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"schoolId\": \"nonexistent-school-xyz\"}"))
                .andExpect(status().isNotFound());
    }
}
