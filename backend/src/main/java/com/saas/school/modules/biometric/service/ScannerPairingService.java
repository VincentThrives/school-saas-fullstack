package com.saas.school.modules.biometric.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.biometric.dto.PairDeviceRequest;
import com.saas.school.modules.biometric.dto.PairDeviceResponse;
import com.saas.school.modules.biometric.dto.PairingCodeResponse;
import com.saas.school.modules.biometric.model.ScannerDevice;
import com.saas.school.modules.biometric.model.ScannerPairingCode;
import com.saas.school.modules.biometric.repository.ScannerDeviceRepository;
import com.saas.school.modules.biometric.repository.ScannerPairingCodeRepository;
import com.saas.school.modules.tenant.model.Tenant;
import com.saas.school.modules.tenant.repository.TenantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Handles the two-step tablet pairing flow.
 * <ul>
 *   <li>{@link #createPairingCode}: admin generates a 6-digit code with a 15-minute TTL.</li>
 *   <li>{@link #redeemPairingCode}: tablet posts the code, gets a long-lived device token back.</li>
 * </ul>
 *
 * <p>Both {@code ScannerDevice} and {@code ScannerPairingCode} live in
 * the tenant DB. Pairing-code redemption from an unauthenticated tablet
 * needs to know the tenant — we solve that by having the admin's UI
 * pass the tenant's subdomain to the tablet along with the code (typed
 * together as one "pairing bundle" at first launch), OR by letting the
 * tablet ask the user for the school code first. Phase 1 keeps it
 * simple: admin manually types the subdomain on the tablet first, then
 * the code. The tenant is then resolved and the redemption hits the
 * tenant DB directly.</p>
 */
@Service
public class ScannerPairingService {

    @Autowired private ScannerDeviceRepository deviceRepository;
    @Autowired private ScannerPairingCodeRepository pairingRepository;
    @Autowired private TenantRepository tenantRepository;

    private final SecureRandom random = new SecureRandom();

    // ── Admin: generate a code ───────────────────────────────

    public PairingCodeResponse createPairingCode(String deviceLabel, String userId) {
        String label = (deviceLabel == null || deviceLabel.isBlank()) ? "Gate device" : deviceLabel.trim();

        String code = String.format("%06d", random.nextInt(1_000_000));
        String codeHash = sha256(code);

        ScannerPairingCode row = new ScannerPairingCode();
        row.setCodeHash(codeHash);
        row.setTenantId(TenantContext.getTenantId());
        row.setDeviceLabel(label);
        row.setCreatedByUserId(userId);
        row.setExpiresAt(Instant.now().plus(15, ChronoUnit.MINUTES));
        pairingRepository.save(row);

        return new PairingCodeResponse(code, row.getExpiresAt(), label);
    }

    // ── Tablet: redeem a code (public) ───────────────────────

    /**
     * Public entry point — no user auth, no tenant context set on the
     * request. The admin types the tenant identifier (subdomain) on the
     * tablet's first-launch screen along with the code; we resolve the
     * tenant from master DB, set the context, then look up the code
     * and mint a device token.
     */
    public PairDeviceResponse redeemPairingCode(String tenantIdentifier, PairDeviceRequest req) {
        if (req == null || req.getCode() == null || req.getCode().isBlank()) {
            throw new BusinessException("Pairing code is required.");
        }
        if (tenantIdentifier == null || tenantIdentifier.isBlank()) {
            throw new BusinessException("School identifier is required.");
        }
        String code = req.getCode().trim();
        if (!code.matches("\\d{6}")) {
            throw new BusinessException("Pairing code must be 6 digits.");
        }

        Tenant tenant = resolveTenant(tenantIdentifier);
        if (tenant.getBiometricSettings() == null
                || (!tenant.getBiometricSettings().isCardEnabled()
                        && !tenant.getBiometricSettings().isFaceEnabled())) {
            throw new BusinessException(
                    "Biometric attendance is not turned on for this school yet.");
        }

        String previousContext = TenantContext.getTenantId();
        TenantContext.setTenantId(tenant.getTenantId());
        try {
            String codeHash = sha256(code);
            ScannerPairingCode found = pairingRepository.findByCodeHash(codeHash).orElse(null);
            if (found == null) throw new BusinessException("Invalid pairing code.");
            if (found.getUsedAt() != null) throw new BusinessException("This code has already been used.");
            if (found.getExpiresAt() != null && Instant.now().isAfter(found.getExpiresAt())) {
                throw new BusinessException("This code has expired. Ask the admin to generate a new one.");
            }
            if (!tenant.getTenantId().equals(found.getTenantId())) {
                throw new BusinessException("This code belongs to a different school.");
            }

            // Mint the device.
            String plaintext = UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "");
            String tokenHash = sha256(plaintext);

            ScannerDevice device = new ScannerDevice();
            device.setDeviceId(UUID.randomUUID().toString());
            device.setTenantId(tenant.getTenantId());
            device.setLabel(found.getDeviceLabel());
            device.setDeviceTokenHash(tokenHash);
            device.setPairedByUserId(found.getCreatedByUserId());
            device.setLastSeenAt(Instant.now());
            deviceRepository.save(device);

            // Burn the code.
            found.setUsedAt(Instant.now());
            found.setUsedByDeviceId(device.getDeviceId());
            pairingRepository.save(found);

            return new PairDeviceResponse(
                    plaintext,
                    device.getDeviceId(),
                    device.getLabel(),
                    tenant.getTenantId(),
                    tenant.getSchoolName(),
                    tenant.getSubdomain()
            );
        } finally {
            if (previousContext != null) TenantContext.setTenantId(previousContext);
            else TenantContext.clear();
        }
    }

    // ── Admin: list + revoke ─────────────────────────────────

    public List<ScannerDevice> listMyDevices() {
        return deviceRepository.findByTenantIdAndRevokedAtIsNullOrderByPairedAtDesc(
                TenantContext.getTenantId());
    }

    public void revoke(String deviceId, String userId) {
        ScannerDevice d = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new BusinessException("Device not found."));
        if (!TenantContext.getTenantId().equals(d.getTenantId())) {
            throw new BusinessException("This device belongs to another school.");
        }
        d.setRevokedAt(Instant.now());
        d.setRevokedBy(userId);
        deviceRepository.save(d);
    }

    // ── Helpers ─────────────────────────────────────────────

    private Tenant resolveTenant(String identifier) {
        String saved = TenantContext.getTenantId();
        TenantContext.clear();
        try {
            Tenant t = tenantRepository.findBySubdomain(identifier).orElse(null);
            if (t == null) t = tenantRepository.findById(identifier).orElse(null);
            if (t == null) throw new BusinessException("School not found.");
            return t;
        } finally {
            if (saved != null) TenantContext.setTenantId(saved);
        }
    }

    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 unavailable", e);
        }
    }
}
