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

    @Override
    public void run(String... args) {
        seedSuperAdmin();
        seedFeatureCatalog();
    }

    private void seedSuperAdmin() {
        if (superAdminRepo.findByEmail("admin@schoolsaas.com").isEmpty()) {
            SuperAdminUser admin = new SuperAdminUser();
            admin.setUserId(UUID.randomUUID().toString());
            admin.setEmail("admin@schoolsaas.com");
            admin.setPasswordHash(passwordEncoder.encode("Admin@123"));
            admin.setFirstName("Super");
            admin.setLastName("Admin");
            admin.setIsActive(true);
            superAdminRepo.save(admin);
            log.warn("⚠️  Default Super Admin created: admin@schoolsaas.com / Admin@123 — CHANGE IMMEDIATELY");
        }
    }

    private void seedFeatureCatalog() {
        if (featureCatalogRepo.count() == 0) {
            int order = 0;
            List<FeatureCatalog> catalog = List.of(
                feature("attendance",    "Attendance",          "Daily attendance tracking",                     true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("timetable",     "Timetable",           "Class schedule management",                     true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("exams",         "Exams & Marks",       "Traditional exam management",                   true,  "exams",          false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("mcq",           "MCQ Engine",          "Online MCQ exam system",                        false, "exams",          false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("fee",           "Fee Management",      "Fee structure and payments",                    true,  "finance",        false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("notifications", "Notifications",       "In-app and email notifications",                true,  "communication",  false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("events",        "Events & Holidays",   "School calendar management",                    true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("messaging",     "Messaging",           "Internal messaging between users",              false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("content",       "Study Materials",     "Upload and manage study content",               true,  "academics",      false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("report_cards",  "Report Cards",        "Generate PDF report cards",                     true,  "reports",        false, ++order, SubscriptionPlan.BASIC, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("bulk_import",   "Bulk Import",         "CSV/Excel data import",                         false, "system",         false, ++order, SubscriptionPlan.ENTERPRISE),
                feature("parent_portal", "Parent Portal",       "Parent access and notifications",               false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE),
                feature("analytics",     "Analytics",           "Advanced reports and charts",                   false, "reports",        false, ++order, SubscriptionPlan.ENTERPRISE),
                feature("whatsapp",      "WhatsApp Messaging",  "Send bulk WhatsApp messages to parents",       false, "communication",  false, ++order, SubscriptionPlan.STANDARD, SubscriptionPlan.ENTERPRISE)
            );
            featureCatalogRepo.saveAll(catalog);
            log.info("Feature catalog seeded with {} features", catalog.size());
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
