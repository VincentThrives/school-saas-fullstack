package com.saas.school.modules.whatsapp.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.whatsapp.dto.RecipientInfo;
import com.saas.school.modules.whatsapp.dto.SendWhatsAppRequest;
import com.saas.school.modules.whatsapp.model.WhatsAppMessage;
import com.saas.school.modules.whatsapp.service.WhatsAppService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "WhatsApp")
@RestController
@RequestMapping("/api/v1/whatsapp")
public class WhatsAppController {

    @Autowired
    private WhatsAppService whatsAppService;

    @Value("${app.file.upload-dir}")
    private String uploadDir;

    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<WhatsAppMessage>> sendMessage(
            @Valid @RequestBody SendWhatsAppRequest request,
            @AuthenticationPrincipal String userId) {
        WhatsAppMessage message = whatsAppService.sendBulkMessage(request, userId);
        return ResponseEntity.ok(ApiResponse.success(message, "WhatsApp messages queued for delivery"));
    }

    @GetMapping("/messages")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Page<WhatsAppMessage>>> getMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<WhatsAppMessage> result = whatsAppService.getMessages(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/messages/{messageId}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<WhatsAppMessage>> getMessageById(@PathVariable String messageId) {
        return ResponseEntity.ok(ApiResponse.success(whatsAppService.getMessageById(messageId)));
    }

    @PostMapping("/resolve-recipients")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<List<RecipientInfo>>> resolveRecipients(
            @RequestBody SendWhatsAppRequest request) {
        List<RecipientInfo> recipients = whatsAppService.resolveRecipients(
                request.getRecipientType(), request.getClassId(), request.getParentIds());
        return ResponseEntity.ok(ApiResponse.success(recipients));
    }

    @PostMapping("/upload-media")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadMedia(
            @RequestParam("file") MultipartFile file) throws IOException {
        Path uploadPath = Paths.get(uploadDir, "whatsapp");
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String originalFilename = file.getOriginalFilename();
        String storedFilename = UUID.randomUUID().toString() + "_" + originalFilename;
        Path filePath = uploadPath.resolve(storedFilename);
        Files.copy(file.getInputStream(), filePath);

        Map<String, String> result = Map.of(
                "url", "/uploads/whatsapp/" + storedFilename,
                "fileName", originalFilename != null ? originalFilename : storedFilename,
                "mimeType", file.getContentType() != null ? file.getContentType() : "application/octet-stream"
        );

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
