package com.saas.school.modules.classes.service;

import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * One-shot migration on backend boot that converts legacy Subject
 * documents (single {@code classId} + sections discovered indirectly
 * via the matching SchoolClass document's section.subjectIds arrays)
 * into the new shape with an inline {@code assignments} array.
 *
 * <p>Idempotent — subjects that already have an assignments array are
 * skipped, so the runner can fire on every boot without re-doing
 * work.
 *
 * <p>The {@code classId} field is left in place on migrated documents
 * for safety (a rollback could read it back); new writes never touch
 * it.
 */
@Component
public class SubjectAssignmentMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SubjectAssignmentMigration.class);

    @Autowired private SubjectRepository subjectRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;

    @Override
    public void run(String... args) {
        // No tenant context at boot — this runs against the central DB
        // only. Per-tenant migrations would need to walk every tenant's
        // DB explicitly; for now we just convert anything visible at
        // boot. Schools that come online later run the same convert
        // path naturally because the legacy createSubject endpoint is
        // gone and all new writes use assignments.
        try {
            List<Subject> legacy = subjectRepository.findLegacyUnmigrated();
            if (legacy.isEmpty()) {
                log.debug("SubjectAssignmentMigration: nothing to migrate.");
                return;
            }
            log.info("SubjectAssignmentMigration: migrating {} legacy subjects to assignments shape", legacy.size());

            int migrated = 0;
            for (Subject s : legacy) {
                @SuppressWarnings("deprecation")
                String legacyClassId = s.getClassId();
                if (legacyClassId == null || legacyClassId.isBlank()) continue;

                // Walk the class doc's sections; collect the ones whose
                // subjectIds list includes this subject. If the class
                // can't be found (deleted), fall back to an empty
                // sectionIds list — the assignment still records the
                // class for queries.
                SchoolClass cls = schoolClassRepository.findById(legacyClassId).orElse(null);
                List<String> sectionIds = new ArrayList<>();
                if (cls != null && cls.getSections() != null) {
                    for (SchoolClass.Section sec : cls.getSections()) {
                        if (sec.getSubjectIds() != null && sec.getSubjectIds().contains(s.getSubjectId())) {
                            sectionIds.add(sec.getSectionId());
                        }
                    }
                }

                List<Subject.Assignment> assignments = new ArrayList<>();
                assignments.add(new Subject.Assignment(legacyClassId, sectionIds));
                s.setAssignments(assignments);
                subjectRepository.save(s);
                migrated++;
            }
            log.info("SubjectAssignmentMigration: migrated {} subjects", migrated);
        } catch (Exception e) {
            // Don't block boot if the migration fails — fall through and let
            // the new endpoints continue working for fresh tenants.
            log.warn("SubjectAssignmentMigration failed (non-fatal): {}", e.getMessage());
        }
    }
}
