package com.saas.school.config;

import com.saas.school.modules.featureflag.model.FeatureCatalog;
import com.saas.school.modules.featureflag.repository.FeatureCatalogRepository;
import com.saas.school.modules.superadmin.model.SuperAdminUser;
import com.saas.school.modules.superadmin.repository.SuperAdminUserRepository;
import com.saas.school.modules.tenant.model.Tenant.SubscriptionPlan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Seeds the central DB with:
 *   1. Default SUPER_ADMIN account (change password immediately in production)
 *   2. Feature catalog entries
 *
 * Safe to run on every startup — checks existence before inserting.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired private SuperAdminUserRepository superAdminRepo;
    @Autowired private FeatureCatalogRepository featureCatalogRepo;
    @Autowired private PasswordEncoder passwordEncoder;

    /**
     * Feature keys that were seeded in earlier builds and have since
     * been removed / consolidated. Cleared from the catalog on every
     * startup so a super-admin's Feature Management page doesn't keep
     * showing ghosts. Tenant {@code featureFlags} maps that still
     * carry these keys are harmless (no runtime check references
     * them) so we don't touch tenant rows — that lets us safely
     * re-add a key later without losing prior settings.
     */
    private static final List<String> OBSOLETE_FEATURE_KEYS = List.of(
        // HR granular sub-features — collapsed into a single
        // hr_attendance sub-module.
        "hr_attendance_daily",
        "hr_attendance_settings",
        "hr_attendance_approvals",
        "hr_terminal_bindings"
    );

    @Override
    public void run(String... args) {
        seedSuperAdmin();
        seedFeatureCatalog();
        pruneObsoleteFeatures();
    }

    /** Idempotent delete of removed feature keys. Logs when it
     *  actually removes anything so a fresh DB doesn't fill the
     *  log on every boot. */
    private void pruneObsoleteFeatures() {
        int removed = 0;
        for (String key : OBSOLETE_FEATURE_KEYS) {
            if (featureCatalogRepo.existsById(key)) {
                featureCatalogRepo.deleteById(key);
                removed++;
            }
        }
        if (removed > 0) {
            log.info("Feature catalog: pruned {} obsolete keys", removed);
        }
    }

    private void seedSuperAdmin() {
        if (superAdminRepo.findByEmail("admin@schoolsaas.com").isEmpty()) {
            SuperAdminUser admin = new SuperAdminUser();
            admin.setUserId(UUID.randomUUID().toString());
            admin.setEmail("admin@schoolsaas.com");
            admin.setPasswordHash(passwordEncoder.encode("Admin@123"));
            admin.setFirstName("Super");
            admin.setLastName("Admin");
            admin.setActive(true);
            superAdminRepo.save(admin);
            log.warn("⚠️  Default Super Admin created: admin@schoolsaas.com / Admin@123 — CHANGE IMMEDIATELY");
        }
    }

    private void seedFeatureCatalog() {
        int order = 0;
        List<FeatureCatalog> catalog = List.of(
            feature("attendance",         "Attendance",          "Daily attendance tracking",                     true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("timetable",          "Timetable",           "Class schedule management",                     true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("exams",              "Exams & Marks",       "Traditional exam management",                   true,  "exams",          false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("mcq",                "MCQ Engine",          "Online MCQ exam system",                        false, "exams",          false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("fee",                "Fee Management",      "Fee structure and payments",                    true,  "finance",        false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("notifications",      "Notifications",       "In-app and email notifications",                true,  "communication",  false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("events",             "Events & Holidays",   "School calendar management",                    true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("messaging",          "Messaging",           "Internal messaging between users",              false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("content",            "Study Materials",     "Upload and manage study content",               true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("report_cards",       "Report Cards",        "Generate PDF report cards",                     true,  "reports",        false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("bulk_import",        "Bulk Import",         "CSV/Excel data import",                         false, "system",         false, ++order, SubscriptionPlan.ENTERPRISE),
            feature("parent_portal",      "Parent Portal",       "Parent access and notifications",               false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("analytics",          "Analytics",           "Advanced reports and charts",                   false, "reports",        false, ++order, SubscriptionPlan.ENTERPRISE),
            feature("whatsapp",           "WhatsApp Messaging",  "Send bulk WhatsApp messages to parents",       false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("idcards",            "ID Card Generator",   "Generate student and staff ID cards with QR codes", false, "system",    false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("syllabus",           "Syllabus Tracker",    "Track syllabus completion per subject per class",   false, "academics", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("assignments",        "Assignments",         "Create assignments, students submit online",        false, "academics", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("ptm",                "PTM Scheduler",       "Schedule parent-teacher meetings with time slots",  false, "communication", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("biometric_terminal", "Attendance Terminals (hardware)", "Receive scans from eSSL / ZKTeco face + card terminals at the school gate", false, "academics", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),

            // ── HR module (umbrella + sub-modules) ─────────────
            // Two-tier structure so we can add sub-modules like
            // hr_leave, hr_payroll later without complicating the
            // per-page toggling. Each sub-module bundles all the
            // pages that belong to it — turning on hr_attendance
            // enables Daily / Approvals / Settings / Terminal
            // Bindings as one coherent surface (they don't make
            // sense in isolation).
            feature("hr_module",     "HR Module", "Employee HR surface (attendance, leave, later payroll)", false, "hr", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("hr_attendance", "HR — Attendance", "Daily view + settings + approvals + terminal bindings for employee attendance", true, "hr", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
            feature("hr_leave",      "HR — Leave", "Leave applications + approvals + leave-type catalog for employees", true, "hr", false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE)
        );
        // Upsert-style seed: pre-existing catalogs (already seeded on the
        // count==0 path in older builds) still receive any new entries we
        // add later — biometric_terminal being the first such addition.
        int added = 0;
        for (FeatureCatalog fc : catalog) {
            if (!featureCatalogRepo.existsById(fc.getFeatureKey())) {
                featureCatalogRepo.save(fc);
                added++;
            }
        }
        if (added > 0) {
            log.info("Feature catalog: inserted {} missing entries (total {})", added, catalog.size());
        }
    }

    private FeatureCatalog feature(String key, String name, String desc,
                                    boolean defaultEnabled, String category,
                                    boolean coreFeature, int sortOrder,
                                    SubscriptionPlan... plans) {
        FeatureCatalog catalog = new FeatureCatalog();
        catalog.setFeatureKey(key);
        catalog.setDisplayName(name);
        catalog.setDescription(desc);
        catalog.setDefaultEnabled(defaultEnabled);
        catalog.setAvailableInPlans(List.of(plans));
        catalog.setCategory(category);
        catalog.setCoreFeature(coreFeature);
        catalog.setSortOrder(sortOrder);
        return catalog;
    }
}
