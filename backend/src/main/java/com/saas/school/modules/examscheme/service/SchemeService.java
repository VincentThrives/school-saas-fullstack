package com.saas.school.modules.examscheme.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.examscheme.model.Scheme;
import com.saas.school.modules.examscheme.repository.SchemeRepository;
import com.saas.school.modules.examtype.model.ExamType;
import com.saas.school.modules.examtype.repository.ExamTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class SchemeService {

    @Autowired private SchemeRepository repo;
    @Autowired private ExamRepository examRepository;
    @Autowired private AcademicYearRepository academicYearRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private ExamTypeRepository examTypeRepository;

    // ──────────────────────────────────────────────────────────────────
    // CRUD
    // ──────────────────────────────────────────────────────────────────

    /**
     * Lists schemes, optionally filtered by year. On first call any legacy
     * row with a null academicYearId gets stamped with the current year so
     * admins never see a "needs year" state.
     */
    public List<Scheme> list(boolean includeArchived, String academicYearId) {
        List<Scheme> all = includeArchived
                ? repo.findAllByOrderByDisplayOrderAscNameAsc()
                : repo.findByStatusOrderByDisplayOrderAscNameAsc(Scheme.Status.ACTIVE);
        if (academicYearId == null || academicYearId.isBlank()) return all;
        List<Scheme> out = new ArrayList<>();
        for (Scheme s : all) {
            if (academicYearId.equals(s.getAcademicYearId())) out.add(s);
        }
        return out;
    }

    public Scheme create(Scheme req) {
        String name = trim(req.getName());
        if (name.isEmpty()) throw new BusinessException("Name is required");
        if (repo.existsByNameIgnoreCase(name)) {
            throw new BusinessException("A scheme named \"" + name + "\" already exists");
        }
        req.setId(UUID.randomUUID().toString());
        req.setName(name);
        if (req.getStatus() == null) req.setStatus(Scheme.Status.ACTIVE);
        if (req.getDisplayOrder() <= 0) req.setDisplayOrder((int) (repo.count() + 1));
        if (req.getAcademicYearId() == null || req.getAcademicYearId().isBlank()) {
            String currentId = currentAcademicYearId();
            if (currentId == null) throw new BusinessException("No current academic year is set — cannot create scheme");
            req.setAcademicYearId(currentId);
        }
        normalizeAndValidateSlots(req);
        assertNoClassConflict(req, null);
        return repo.save(req);
    }

    public Scheme update(String id, Scheme req) {
        Scheme existing = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Scheme", id));

        String newName = trim(req.getName());
        if (!newName.isEmpty() && !newName.equalsIgnoreCase(existing.getName())) {
            if (repo.existsByNameIgnoreCase(newName)) {
                throw new BusinessException("A scheme named \"" + newName + "\" already exists");
            }
            existing.setName(newName);
        }
        if (req.getDisplayOrder() > 0) existing.setDisplayOrder(req.getDisplayOrder());
        existing.setDescription(req.getDescription());
        existing.setApplicableClassIds(req.getApplicableClassIds());
        String reqYear = req.getAcademicYearId();
        if (reqYear != null && !reqYear.isBlank()) {
            existing.setAcademicYearId(reqYear);
        } else if (existing.getAcademicYearId() == null) {
            String currentId = currentAcademicYearId();
            if (currentId == null) throw new BusinessException("No current academic year is set — cannot update scheme");
            existing.setAcademicYearId(currentId);
        }
        existing.setSlots(req.getSlots());
        existing.setPassingPercent(req.getPassingPercent());
        normalizeAndValidateSlots(existing);
        assertNoClassConflict(existing, id);
        return repo.save(existing);
    }

    public Scheme archive(String id) {
        Scheme s = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Scheme", id));
        s.setStatus(Scheme.Status.ARCHIVED);
        return repo.save(s);
    }

    public Scheme restore(String id) {
        Scheme s = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Scheme", id));
        s.setStatus(Scheme.Status.ACTIVE);
        return repo.save(s);
    }

    public void delete(String id) {
        Scheme s = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Scheme", id));
        long inUse = examRepository.findByExamTypeSchemeId(id).size();
        if (inUse > 0) {
            throw new BusinessException("This scheme has " + inUse + " exam(s) rolled out. Delete those first, or archive the scheme instead.");
        }
        repo.deleteById(id);
    }

    // ──────────────────────────────────────────────────────────────────
    // Validation
    // ──────────────────────────────────────────────────────────────────

    private void normalizeAndValidateSlots(Scheme s) {
        List<Scheme.Slot> slots = s.getSlots();
        if (slots == null) return;
        Set<String> keys = new HashSet<>();
        for (int i = 0; i < slots.size(); i++) {
            Scheme.Slot slot = slots.get(i);
            if (slot == null) throw new BusinessException("Slot #" + (i + 1) + " is empty");
            String label = trim(slot.getLabel());
            if (label.isEmpty()) throw new BusinessException("Slot #" + (i + 1) + " needs an exam name");
            slot.setLabel(label);
            String key = trim(slot.getKey());
            if (key.isEmpty()) key = slugify(label);
            if (!keys.add(key)) throw new BusinessException("Duplicate slot key \"" + key + "\" — exam names must be unique");
            slot.setKey(key);
            if (slot.getRawMax() <= 0) throw new BusinessException("Slot \"" + label + "\": raw max must be > 0");
            if (slot.getWeightMax() <= 0) throw new BusinessException("Slot \"" + label + "\": weighted max must be > 0");
            if (slot.getWeightMax() > slot.getRawMax()) {
                throw new BusinessException("Slot \"" + label + "\": weighted (" + slot.getWeightMax()
                        + ") can't exceed raw (" + slot.getRawMax() + ")");
            }

            // Components sum == raw.
            List<Scheme.Component> comps = slot.getComponents();
            if (comps != null && !comps.isEmpty()) {
                Set<String> compKeys = new HashSet<>();
                double sum = 0;
                for (int ci = 0; ci < comps.size(); ci++) {
                    Scheme.Component c = comps.get(ci);
                    if (c == null) throw new BusinessException("Slot \"" + label + "\": component #" + (ci + 1) + " is empty");
                    String cLabel = trim(c.getLabel());
                    if (cLabel.isEmpty()) throw new BusinessException("Slot \"" + label + "\": component #" + (ci + 1) + " needs a label");
                    c.setLabel(cLabel);
                    String cKey = trim(c.getKey());
                    if (cKey.isEmpty()) cKey = slugify(cLabel);
                    if (!compKeys.add(cKey)) {
                        throw new BusinessException("Slot \"" + label + "\": duplicate component key \"" + cKey + "\"");
                    }
                    c.setKey(cKey);
                    if (c.getMaxMarks() <= 0) {
                        throw new BusinessException("Slot \"" + label + "\": component \"" + cLabel + "\" needs max > 0");
                    }
                    sum += c.getMaxMarks();
                }
                if (!approxEq(sum, slot.getRawMax())) {
                    throw new BusinessException("Slot \"" + label + "\": components sum to "
                            + stripTrailingZeros(sum) + " but raw max is " + stripTrailingZeros(slot.getRawMax()));
                }
            }

            // SubjectConfigs sanity.
            List<Scheme.SubjectConfig> cfgs = slot.getSubjectConfigs();
            if (cfgs != null) {
                Set<String> cfgIds = new HashSet<>();
                for (Scheme.SubjectConfig c : cfgs) {
                    if (c == null) continue;
                    if (trim(c.getSubjectId()).isEmpty()) {
                        throw new BusinessException("Slot \"" + label + "\": subject row missing subject");
                    }
                    if (!cfgIds.add(c.getSubjectId())) {
                        throw new BusinessException("Slot \"" + label + "\": subject appears twice in the slot's subject list");
                    }
                    if (c.getRawMax() <= 0 || c.getWeightMax() <= 0) {
                        throw new BusinessException("Slot \"" + label + "\": subject row needs raw & weighted > 0");
                    }
                    if (c.getWeightMax() > c.getRawMax()) {
                        throw new BusinessException("Slot \"" + label + "\": subject row weighted can't exceed raw");
                    }
                    if (c.getPulledContributionMax() != null) {
                        if (c.getPulledContributionMax() <= 0) {
                            throw new BusinessException("Slot \"" + label + "\": subject row pulled must be > 0 when set");
                        }
                        if (slot.getPullForward() == null) {
                            throw new BusinessException("Slot \"" + label + "\": subject row has pulled but the slot has no pull-forward");
                        }
                    }
                }
            }

            // Pull-forward.
            Scheme.PullForward pf = slot.getPullForward();
            if (pf != null) {
                List<String> refs = pf.getFromSlotKeys();
                if (refs == null || refs.isEmpty()) {
                    throw new BusinessException("Slot \"" + label + "\": pull-forward needs at least one source slot");
                }
                Set<String> earlier = new HashSet<>();
                for (int pi = 0; pi < i; pi++) earlier.add(slots.get(pi).getKey());
                for (String ref : refs) {
                    if (ref == null || ref.isBlank()) {
                        throw new BusinessException("Slot \"" + label + "\": pull-forward has an empty source key");
                    }
                    if (!earlier.contains(ref)) {
                        throw new BusinessException("Slot \"" + label + "\": pull-forward source \""
                                + ref + "\" is not an earlier slot");
                    }
                }
                if (pf.getContributionMax() <= 0) {
                    throw new BusinessException("Slot \"" + label + "\": pull-forward contribution must be > 0");
                }
            }
        }
    }

    private void assertNoClassConflict(Scheme candidate, String excludeId) {
        List<Scheme> peers = repo.findByStatusOrderByDisplayOrderAscNameAsc(Scheme.Status.ACTIVE);
        boolean candidateAll = candidate.getApplicableClassIds() == null
                || candidate.getApplicableClassIds().isEmpty();
        Set<String> wanted = candidateAll ? Set.of() : new HashSet<>(candidate.getApplicableClassIds());
        for (Scheme other : peers) {
            if (excludeId != null && excludeId.equals(other.getId())) continue;
            if (!java.util.Objects.equals(candidate.getAcademicYearId(), other.getAcademicYearId())) continue;
            boolean otherAll = other.getApplicableClassIds() == null
                    || other.getApplicableClassIds().isEmpty();
            if (candidateAll && otherAll) {
                throw new BusinessException("Scheme \"" + other.getName()
                        + "\" already covers every class for this year — can't add another all-classes scheme");
            }
            if (candidateAll && !otherAll) {
                throw new BusinessException("Scheme \"" + other.getName() + "\" already uses "
                        + other.getApplicableClassIds().size() + " class(es) for this year — pick specific classes instead");
            }
            if (!candidateAll && otherAll) {
                throw new BusinessException("Scheme \"" + other.getName()
                        + "\" is set as all-classes for this year — remove its all-classes assignment first");
            }
            for (String cid : other.getApplicableClassIds()) {
                if (wanted.contains(cid)) {
                    throw new BusinessException("Class already assigned to scheme \""
                            + other.getName() + "\" for this year — a class can belong to only one scheme per year");
                }
            }
        }
    }

    private String currentAcademicYearId() {
        return academicYearRepository.findByIsCurrent(true)
                .map(AcademicYear::getAcademicYearId)
                .orElse(null);
    }

    // ──────────────────────────────────────────────────────────────────
    // Rollout
    // ──────────────────────────────────────────────────────────────────

    public static class RolloutResult {
        public int created;
        public int skippedExisting;
        public int skippedNoSubjects;

        public RolloutResult(int created, int skippedExisting, int skippedNoSubjects) {
            this.created = created;
            this.skippedExisting = skippedExisting;
            this.skippedNoSubjects = skippedNoSubjects;
        }

        public int getCreated() { return created; }
        public int getSkippedExisting() { return skippedExisting; }
        public int getSkippedNoSubjects() { return skippedNoSubjects; }
    }

    public static class RolloutStatusRow {
        public String slotKey;
        public String slotLabel;
        public int created;
        public int totalExpected;

        public RolloutStatusRow(String slotKey, String slotLabel, int created, int totalExpected) {
            this.slotKey = slotKey;
            this.slotLabel = slotLabel;
            this.created = created;
            this.totalExpected = totalExpected;
        }

        public String getSlotKey() { return slotKey; }
        public String getSlotLabel() { return slotLabel; }
        public int getCreated() { return created; }
        public int getTotalExpected() { return totalExpected; }
    }

    public RolloutResult rolloutSlot(String schemeId, String slotKey, String examName) {
        Scheme scheme = repo.findById(schemeId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheme", schemeId));
        if (scheme.getSlots() == null || scheme.getSlots().isEmpty()) {
            throw new BusinessException("Scheme \"" + scheme.getName() + "\" has no slots to roll out");
        }
        Scheme.Slot slot = scheme.getSlots().stream()
                .filter(s -> slotKey.equals(s.getKey())).findFirst()
                .orElseThrow(() -> new BusinessException("Slot \"" + slotKey + "\" not found on this scheme"));
        String yearId = scheme.getAcademicYearId();
        if (yearId == null || yearId.isBlank()) {
            throw new BusinessException("Scheme has no academic year — set one before rollout");
        }

        List<SchoolClass> targetClasses = resolveTargetClasses(scheme, yearId);
        if (targetClasses.isEmpty()) {
            throw new BusinessException("No classes to roll out — the scheme's applicable classes don't exist in this year");
        }

        List<Exam> existing = examRepository.findByExamTypeSchemeIdAndSlotKey(schemeId, slotKey);
        Set<String> existingKeys = new HashSet<>();
        for (Exam e : existing) {
            existingKeys.add(dedupKey(e.getClassId(), e.getSectionId(), e.getSubjectId()));
        }

        boolean usingConfigs = slot.getSubjectConfigs() != null && !slot.getSubjectConfigs().isEmpty();
        Map<String, Scheme.SubjectConfig> configBySubject = new HashMap<>();
        if (usingConfigs) {
            for (Scheme.SubjectConfig sc : slot.getSubjectConfigs()) {
                if (sc != null && sc.getSubjectId() != null) configBySubject.put(sc.getSubjectId(), sc);
            }
        }

        // Resolve type name once — defaults to the slot label when the type is missing.
        String typeName = resolveTypeName(slot.getTypeId());
        // Legacy safety net: schemes created before applyDefaultTypeIdWhereMissing()
        // shipped have slot.typeId="" in Mongo (preset was applied before the
        // catalog loaded). Rather than stamp the raw slot label ("FA1") onto
        // every exam, try to infer the type by matching the label's prefix
        // against a catalog key ("FA1" → "FA"). Keeps the Exam Config list
        // grouped sanely for those legacy rollouts.
        if (typeName == null || typeName.isBlank()) {
            typeName = inferTypeKeyFromLabel(slot.getLabel());
        }

        int created = 0, skippedExisting = 0, skippedNoSubjects = 0;
        for (SchoolClass cls : targetClasses) {
            List<Subject> classSubjects = subjectRepository.findByClassIdAndAcademicYearId(
                    cls.getClassId(), yearId);
            if (classSubjects.isEmpty()) { skippedNoSubjects++; continue; }
            if (cls.getSections() == null) continue;
            for (SchoolClass.Section section : cls.getSections()) {
                for (Subject subject : classSubjects) {
                    if (!subjectCoversSection(subject, cls.getClassId(), section.getSectionId())) continue;
                    if (usingConfigs) {
                        if (!configBySubject.containsKey(subject.getSubjectId())) continue;
                    } else {
                        if (!subject.isCoreSubject()) continue;
                    }
                    String key = dedupKey(cls.getClassId(), section.getSectionId(), subject.getSubjectId());
                    if (existingKeys.contains(key)) { skippedExisting++; continue; }

                    examRepository.save(buildExamFromSlot(
                            scheme, slot, typeName, examName,
                            configBySubject.get(subject.getSubjectId()),
                            cls, section, subject, yearId));
                    existingKeys.add(key);
                    created++;
                }
            }
        }
        return new RolloutResult(created, skippedExisting, skippedNoSubjects);
    }

    public List<RolloutStatusRow> rolloutStatus(String schemeId) {
        Scheme scheme = repo.findById(schemeId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheme", schemeId));
        List<RolloutStatusRow> rows = new ArrayList<>();
        if (scheme.getSlots() == null) return rows;
        String yearId = scheme.getAcademicYearId();
        List<Exam> all = examRepository.findByExamTypeSchemeId(schemeId);
        Map<String, Integer> createdByKey = new HashMap<>();
        for (Exam e : all) createdByKey.merge(e.getSlotKey(), 1, Integer::sum);
        for (Scheme.Slot s : scheme.getSlots()) {
            int expected = yearId == null ? 0 : expectedExamsPerSlot(scheme, yearId, s);
            rows.add(new RolloutStatusRow(s.getKey(), s.getLabel(),
                    createdByKey.getOrDefault(s.getKey(), 0), expected));
        }
        return rows;
    }

    private List<SchoolClass> resolveTargetClasses(Scheme scheme, String yearId) {
        List<SchoolClass> all = schoolClassRepository.findByAcademicYearId(yearId);
        if (scheme.getApplicableClassIds() == null || scheme.getApplicableClassIds().isEmpty()) return all;
        Set<String> wanted = new HashSet<>(scheme.getApplicableClassIds());
        List<SchoolClass> out = new ArrayList<>();
        for (SchoolClass c : all) if (wanted.contains(c.getClassId())) out.add(c);
        return out;
    }

    private int expectedExamsPerSlot(Scheme scheme, String yearId, Scheme.Slot slot) {
        List<SchoolClass> classes = resolveTargetClasses(scheme, yearId);
        boolean usingConfigs = slot != null && slot.getSubjectConfigs() != null && !slot.getSubjectConfigs().isEmpty();
        Set<String> rosterIds = new HashSet<>();
        if (usingConfigs) {
            for (Scheme.SubjectConfig sc : slot.getSubjectConfigs()) {
                if (sc != null && sc.getSubjectId() != null) rosterIds.add(sc.getSubjectId());
            }
        }
        int total = 0;
        for (SchoolClass cls : classes) {
            List<Subject> subs = subjectRepository.findByClassIdAndAcademicYearId(cls.getClassId(), yearId);
            if (cls.getSections() == null || subs.isEmpty()) continue;
            for (SchoolClass.Section section : cls.getSections()) {
                for (Subject subject : subs) {
                    if (!subjectCoversSection(subject, cls.getClassId(), section.getSectionId())) continue;
                    if (usingConfigs) {
                        if (!rosterIds.contains(subject.getSubjectId())) continue;
                    } else {
                        if (!subject.isCoreSubject()) continue;
                    }
                    total++;
                }
            }
        }
        return total;
    }

    private boolean subjectCoversSection(Subject subject, String classId, String sectionId) {
        List<Subject.Assignment> assignments = subject.getAssignments();
        if (assignments == null || assignments.isEmpty()) return true;
        for (Subject.Assignment a : assignments) {
            if (!classId.equals(a.getClassId())) continue;
            List<String> sids = a.getSectionIds();
            if (sids == null || sids.isEmpty() || sids.contains(sectionId)) return true;
        }
        return false;
    }

    private Exam buildExamFromSlot(Scheme scheme, Scheme.Slot slot, String typeName, String examName,
                                   Scheme.SubjectConfig config,
                                   SchoolClass cls, SchoolClass.Section section,
                                   Subject subject, String yearId) {
        // examName = slot.label by default (what the admin typed in the Rollout dialog).
        // examType = the ExamType catalog entry's key (short code e.g. "FA"/"SA"),
        // falling back to name if the catalog row has no key.
        String displayName = (examName == null || examName.isBlank())
                ? slot.getLabel()
                : examName.trim();
        String displayType = (typeName == null || typeName.isBlank())
                ? slot.getLabel()
                : typeName;

        Exam e = new Exam();
        e.setExamId(UUID.randomUUID().toString());
        e.setName(displayName + " · " + subject.getName());
        e.setExamType(displayType);
        e.setExamTypeSchemeId(scheme.getId());
        e.setSlotKey(slot.getKey());
        e.setAcademicYearId(yearId);
        e.setClassId(cls.getClassId());
        e.setClassName(cls.getName());
        e.setSectionId(section.getSectionId());
        e.setSectionName(section.getName());
        e.setSubjectId(subject.getSubjectId());
        e.setSubjectName(subject.getName());

        double raw = (config != null) ? config.getRawMax() : slot.getRawMax();
        Double pass = (config != null) ? config.getPassingMarks() : slot.getPassingMarks();
        e.setMaxMarks((int) Math.round(raw));
        // Scheme didn't set a passing bar → default to 40% of raw so the Exam
        // Config edit page shows a sensible number instead of 0.
        e.setPassingMarks(pass == null ? (int) Math.floor(raw * 0.4) : (int) Math.round(pass));

        if (slot.getComponents() != null && !slot.getComponents().isEmpty()) {
            // Build a set of this subject's component keys so we only stamp
            // components the subject actually has. Admin can define a scheme
            // slot with [Theory, Project]; a subject with only [Theory] gets
            // just Theory. If NO subject components match any slot components,
            // we fall back to stamping all slot components (legacy behaviour +
            // schemes created before this check existed).
            Set<String> subjectComponentKeys = new HashSet<>();
            if (subject.getComponents() != null) {
                for (Subject.Component subC : subject.getComponents()) {
                    if (subC.getKey() != null) subjectComponentKeys.add(subC.getKey());
                }
            }

            List<Exam.ExamComponent> comps = new ArrayList<>();
            for (Scheme.Component sc : slot.getComponents()) {
                // Skip when the slot references a component this subject doesn't
                // define — unless the subject has NO components at all (legacy)
                // in which case stamp everything so marks entry still works.
                if (!subjectComponentKeys.isEmpty()
                        && sc.getKey() != null
                        && !subjectComponentKeys.contains(sc.getKey())) {
                    continue;
                }
                int cmax = (int) Math.round(sc.getMaxMarks());
                int cpass = sc.getPassingMarks() != null
                        ? (int) Math.round(sc.getPassingMarks())
                        : (int) Math.floor(cmax * 0.35);
                Exam.ExamComponent ec = new Exam.ExamComponent(
                        sc.getKey(), sc.getLabel(), cmax, cpass);
                // Stamp sub-parts when the scheme splits this component.
                if (sc.getSubComponents() != null && !sc.getSubComponents().isEmpty()) {
                    List<Exam.ExamSubComponent> subs = new ArrayList<>();
                    for (Scheme.SubComponent sub : sc.getSubComponents()) {
                        int smax = (int) Math.round(sub.getMaxMarks());
                        int spass = sub.getPassingMarks() != null
                                ? (int) Math.round(sub.getPassingMarks())
                                : (int) Math.floor(smax * 0.35);
                        subs.add(new Exam.ExamSubComponent(
                                sub.getKey(), sub.getLabel(), smax, spass));
                    }
                    ec.setSubComponents(subs);
                }
                comps.add(ec);
            }
            if (!comps.isEmpty()) {
                e.setComponents(comps);
                e.setComponentKey(comps.get(0).getKey());
            }
        }
        e.setStatus(Exam.ExamStatus.SCHEDULED);
        e.setMarksLocked(false);
        return e;
    }

    /**
     * Returns the short display label stamped onto {@code exam.examType} at rollout.
     * Prefers the catalog's {@code key} ("FA"/"SA") over its verbose {@code name}
     * ("Formative"/"Summative") so the Exam Config and Exams chips stay compact.
     * Falls back to the name when key is blank.
     */
    /**
     * Returns the short display label stamped onto {@code exam.examType} at rollout.
     * Prefers the catalog's {@code key} ("FA"/"SA") over its verbose {@code name}
     * ("Formative"/"Summative") so the Exam Config and Exams chips stay compact.
     * Falls back to the name when key is blank.
     */
    private String resolveTypeName(String typeId) {
        if (typeId == null || typeId.isBlank()) return null;
        return examTypeRepository.findById(typeId)
                .map(t -> {
                    String key = t.getKey();
                    return (key != null && !key.isBlank()) ? key : t.getName();
                })
                .orElse(null);
    }

    /**
     * Legacy fallback for schemes saved with a blank {@code slot.typeId} — tries to
     * match the slot label's leading alpha prefix ("FA1" → "FA") against any
     * active catalog key. Returns null when nothing matches, so the caller still
     * falls back to the raw slot label as a last resort.
     */
    private String inferTypeKeyFromLabel(String label) {
        if (label == null || label.isBlank()) return null;
        String upper = label.trim().toUpperCase(Locale.ROOT);
        // "FA1" → "FA", "SA2" → "SA", "MT3" → "MT", "Term 1 Exam" → "TERM"
        StringBuilder prefix = new StringBuilder();
        for (int i = 0; i < upper.length(); i++) {
            char c = upper.charAt(i);
            if (c >= 'A' && c <= 'Z') prefix.append(c);
            else break;
        }
        if (prefix.length() == 0) return null;
        String stem = prefix.toString();
        for (ExamType t : examTypeRepository.findByStatusOrderByDisplayOrderAscNameAsc(ExamType.Status.ACTIVE)) {
            String key = t.getKey();
            if (key != null && !key.isBlank() && stem.startsWith(key.toUpperCase(Locale.ROOT))) {
                return key;
            }
        }
        return null;
    }

    private String dedupKey(String classId, String sectionId, String subjectId) {
        return classId + "::" + sectionId + "::" + subjectId;
    }

    // ──────────────────────────────────────────────────────────────────
    // Subject-seed endpoint (for the editor's per-slot subject table)
    // ──────────────────────────────────────────────────────────────────

    /** One component definition from a Subject — passed to the scheme editor so
     *  the slot-component picker can lock vocabulary to the subject's own
     *  component keys (Theory/Practical/IA/…) rather than free-text labels. */
    public static class SubjectComponentDef {
        public String key;
        public String label;

        public SubjectComponentDef() {}
        public SubjectComponentDef(String key, String label) {
            this.key = key;
            this.label = label;
        }
        public String getKey() { return key; }
        public String getLabel() { return label; }
    }

    public static class SubjectSeedRow {
        public String subjectId;
        public String name;
        public boolean coreSubject;
        public List<String> classNames;
        /** Labels of this subject's components — kept for backward compat with
         *  the autocomplete fallback. Prefer {@link #componentDefs} for new UI. */
        public List<String> componentLabels;
        /** Full (key, label) pairs for every component this subject defines.
         *  Drives the slot-component picker in the scheme editor. */
        public List<SubjectComponentDef> componentDefs;

        public SubjectSeedRow(String subjectId, String name, boolean coreSubject,
                              List<String> classNames, List<String> componentLabels,
                              List<SubjectComponentDef> componentDefs) {
            this.subjectId = subjectId;
            this.name = name;
            this.coreSubject = coreSubject;
            this.classNames = classNames;
            this.componentLabels = componentLabels;
            this.componentDefs = componentDefs;
        }

        public String getSubjectId() { return subjectId; }
        public String getName() { return name; }
        public boolean isCoreSubject() { return coreSubject; }
        public List<String> getClassNames() { return classNames; }
        public List<String> getComponentLabels() { return componentLabels; }
        public List<SubjectComponentDef> getComponentDefs() { return componentDefs; }
    }

    public List<SubjectSeedRow> subjectsForScheme(String schemeId) {
        Scheme scheme = repo.findById(schemeId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheme", schemeId));
        String yearId = scheme.getAcademicYearId();
        if (yearId == null) return List.of();
        List<SchoolClass> classes = resolveTargetClasses(scheme, yearId);
        Map<String, String> classNameById = new HashMap<>();
        for (SchoolClass c : classes) classNameById.put(c.getClassId(), c.getName());

        Map<String, SubjectSeedRow> seen = new HashMap<>();
        for (SchoolClass cls : classes) {
            for (Subject s : subjectRepository.findByClassIdAndAcademicYearId(cls.getClassId(), yearId)) {
                if (s.getSubjectId() == null) continue;
                SubjectSeedRow row = seen.get(s.getSubjectId());
                if (row == null) {
                    row = new SubjectSeedRow(
                            s.getSubjectId(), s.getName(), s.isCoreSubject(),
                            new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
                    seen.put(s.getSubjectId(), row);
                }
                String cname = classNameById.get(cls.getClassId());
                if (cname != null && !row.classNames.contains(cname)) row.classNames.add(cname);
                if (s.getComponents() != null) {
                    Set<String> defKeys = new HashSet<>();
                    for (SubjectComponentDef existing : row.componentDefs) defKeys.add(existing.key);
                    for (Subject.Component sc : s.getComponents()) {
                        String lbl = sc.getLabel();
                        String ckey = sc.getKey();
                        if (lbl != null && !lbl.isBlank() && !row.componentLabels.contains(lbl)) {
                            row.componentLabels.add(lbl);
                        }
                        if (ckey != null && !ckey.isBlank() && !defKeys.contains(ckey)) {
                            row.componentDefs.add(new SubjectComponentDef(ckey, lbl));
                            defKeys.add(ckey);
                        }
                    }
                }
            }
        }
        for (SubjectSeedRow row : seen.values()) row.classNames.sort(String.CASE_INSENSITIVE_ORDER);
        List<SubjectSeedRow> out = new ArrayList<>(seen.values());
        out.sort((a, b) -> {
            if (a.coreSubject != b.coreSubject) return a.coreSubject ? -1 : 1;
            return (a.name == null ? "" : a.name).compareToIgnoreCase(b.name == null ? "" : b.name);
        });
        return out;
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────

    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private static String slugify(String s) {
        String base = s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_");
        return base.replaceAll("^_+|_+$", "");
    }

    private static boolean approxEq(double a, double b) { return Math.abs(a - b) < 0.0001; }

    private static String stripTrailingZeros(double d) {
        if (d == Math.floor(d)) return String.valueOf((long) d);
        return String.valueOf(d);
    }
}
