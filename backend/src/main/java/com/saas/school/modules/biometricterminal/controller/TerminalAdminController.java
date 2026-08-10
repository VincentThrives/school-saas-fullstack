package com.saas.school.modules.biometricterminal.controller;

import com.saas.school.common.response.ApiResponse;
import com.saas.school.modules.biometricterminal.dto.BindUserRequest;
import com.saas.school.modules.biometricterminal.dto.RegisterTerminalRequest;
import com.saas.school.modules.biometricterminal.dto.UpdateBindingRequest;
import com.saas.school.modules.biometricterminal.dto.TerminalBindingResponse;
import com.saas.school.modules.biometricterminal.dto.TerminalResponse;
import com.saas.school.modules.biometricterminal.dto.UpdateTerminalRequest;
import com.saas.school.modules.biometricterminal.service.TerminalRegistrationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/biometric/terminals")
@PreAuthorize("hasRole('SCHOOL_ADMIN')")
public class TerminalAdminController {

    @Autowired private TerminalRegistrationService registrationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TerminalResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(registrationService.list()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TerminalResponse>> register(
            @Valid @RequestBody RegisterTerminalRequest req) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.register(req), "Terminal registered"));
    }

    @PutMapping("/{serial}")
    public ResponseEntity<ApiResponse<TerminalResponse>> updateLabel(
            @PathVariable String serial, @Valid @RequestBody UpdateTerminalRequest req) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.updateLabel(serial, req), "Terminal updated"));
    }

    @DeleteMapping("/{serial}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String serial) {
        registrationService.delete(serial);
        return ResponseEntity.ok(ApiResponse.success(null, "Terminal deleted"));
    }

    @GetMapping("/{serial}/bindings")
    public ResponseEntity<ApiResponse<List<TerminalBindingResponse>>> listBindings(
            @PathVariable String serial) {
        return ResponseEntity.ok(ApiResponse.success(registrationService.listBindings(serial)));
    }

    @PostMapping("/{serial}/bindings")
    public ResponseEntity<ApiResponse<TerminalBindingResponse>> bindUser(
            @PathVariable String serial, @Valid @RequestBody BindUserRequest req,
            @AuthenticationPrincipal String adminUserId) {
        return ResponseEntity.ok(ApiResponse.success(
            registrationService.bindUser(serial, req, adminUserId), "User bound"));
    }

    @DeleteMapping("/{serial}/bindings/{terminalUserId}")
    public ResponseEntity<ApiResponse<Void>> unbind(
            @PathVariable String serial, @PathVariable String terminalUserId) {
        registrationService.unbind(serial, terminalUserId);
        return ResponseEntity.ok(ApiResponse.success(null, "Binding removed"));
    }

    @PutMapping("/{serial}/bindings/{terminalUserId}")
    public ResponseEntity<ApiResponse<TerminalBindingResponse>> updateBinding(
            @PathVariable String serial,
            @PathVariable String terminalUserId,
            @Valid @RequestBody UpdateBindingRequest req,
            @AuthenticationPrincipal String adminUserId) {
        return ResponseEntity.ok(ApiResponse.success(
            registrationService.updateTerminalUserId(serial, terminalUserId, req.getTerminalUserId(), adminUserId),
            "Binding updated"));
    }
}
