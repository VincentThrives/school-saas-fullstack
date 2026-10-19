package com.saas.school.modules.examtype.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.examtype.model.ExamType;
import com.saas.school.modules.examtype.repository.ExamTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * CRUD + seed logic for the ExamType catalog — the small list of "FA / SA /
 * OTHER / Monthly Test / Portfolio …" entries that schemes reference via
 * {@code Slot.typeId}. The heavy scheme logic (slots, rollout, etc.) moved
 * out to {@code modules/examscheme}.
 */
@Service
public class ExamTypeService {

    /** Seeded on first access so the slot editor's dropdown always has FA/SA. */
    private static final Default[] DEFAULTS = {
            new Default("FA", "Formative", "#0369a1", 1),
            new Default("SA", "Summative", "#7c3aed", 2),
    };

    @Autowired private ExamTypeRepository repo;

    public List<ExamType> list(boolean includeArchived) {
        // Seed FA + SA only on an empty catalog (first-ever load for a tenant).
        // Once the admin starts curating the catalog, their deletes stick —
        // we never re-add anything they intentionally removed.
        if (repo.count() == 0) seedDefaults();
        return includeArchived
                ? repo.findAllByOrderByDisplayOrderAscNameAsc()
                : repo.findByStatusOrderByDisplayOrderAscNameAsc(ExamType.Status.ACTIVE);
    }

    public ExamType create(ExamType req) {
        String name = trim(req.getName());
        if (name.isEmpty()) throw new BusinessException("Name is required");
        if (repo.existsByNameIgnoreCase(name)) {
            throw new BusinessException("An exam type named \"" + name + "\" already exists");
        }
        req.setId(UUID.randomUUID().toString());
        req.setName(name);
        if (req.getKey() == null || req.getKey().isBlank()) req.setKey(slugify(name).toUpperCase(Locale.ROOT));
        if (req.getStatus() == null) req.setStatus(ExamType.Status.ACTIVE);
        if (req.getDisplayOrder() <= 0) req.setDisplayOrder((int) (repo.count() + 1));
        return repo.save(req);
    }

    public ExamType update(String id, ExamType req) {
        ExamType existing = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ExamType", id));

        String newName = trim(req.getName());
        if (!newName.isEmpty() && !newName.equalsIgnoreCase(existing.getName())) {
            if (repo.existsByNameIgnoreCase(newName)) {
                throw new BusinessException("An exam type named \"" + newName + "\" already exists");
            }
            existing.setName(newName);
        }
        // Key is immutable once set — renames should re-slug if the admin asks,
        // but that risks orphaning slot.typeId references, so keep it stable.
        if ((existing.getKey() == null || existing.getKey().isBlank())
                && req.getKey() != null && !req.getKey().isBlank()) {
            existing.setKey(req.getKey());
        }
        if (req.getDisplayOrder() > 0) existing.setDisplayOrder(req.getDisplayOrder());
        existing.setDescription(req.getDescription());
        existing.setColor(req.getColor());
        return repo.save(existing);
    }

    public ExamType archive(String id) {
        ExamType e = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
        e.setStatus(ExamType.Status.ARCHIVED);
        return repo.save(e);
    }

    public ExamType restore(String id) {
        ExamType e = repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
        e.setStatus(ExamType.Status.ACTIVE);
        return repo.save(e);
    }

    public void delete(String id) {
        if (!repo.existsById(id)) throw new ResourceNotFoundException("ExamType", id);
        // No cascade on Exam docs — exams carry a free-text examType string, not an id.
        repo.deleteById(id);
    }

    public ExamType get(String id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
    }

    /** Idempotent — adds any missing default (keyed by name) without touching
     *  existing rows. Safe to call on every list request. */
    private void seedDefaults() {
        for (Default d : DEFAULTS) {
            if (repo.existsByNameIgnoreCase(d.name)) continue;
            ExamType e = new ExamType();
            e.setId(UUID.randomUUID().toString());
            e.setName(d.name);
            e.setKey(d.key);
            e.setColor(d.color);
            e.setDisplayOrder(d.order);
            e.setStatus(ExamType.Status.ACTIVE);
            repo.save(e);
        }
    }

    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private static String slugify(String s) {
        String base = s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_");
        return base.replaceAll("^_+|_+$", "");
    }

    private record Default(String key, String name, String color, int order) {}
}
