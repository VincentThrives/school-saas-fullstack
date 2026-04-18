package com.saas.school.modules.examtype.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.examtype.model.ExamType;
import com.saas.school.modules.examtype.repository.ExamTypeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class ExamTypeService {

    private static final String[] DEFAULTS = {
            "Unit Test 1", "Unit Test 2", "Mid Term", "Half Yearly", "Pre Board", "Final", "Annual"
    };

    @Autowired private ExamTypeRepository repo;
    @Autowired private ExamRepository examRepository;

    /** Returns all exam types (optionally including archived). Seeds defaults on first call. */
    public List<ExamType> list(boolean includeArchived) {
        if (repo.count() == 0) {
            seedDefaults();
        }
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
        if (req.getStatus() == null) req.setStatus(ExamType.Status.ACTIVE);
        if (req.getDisplayOrder() <= 0) req.setDisplayOrder(nextOrder());
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
        if (req.getDisplayOrder() > 0) existing.setDisplayOrder(req.getDisplayOrder());
        existing.setDefaultMaxMarks(req.getDefaultMaxMarks());
        existing.setDescription(req.getDescription());
        return repo.save(existing);
    }

    public ExamType archive(String id) {
        ExamType e = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
        e.setStatus(ExamType.Status.ARCHIVED);
        return repo.save(e);
    }

    public ExamType restore(String id) {
        ExamType e = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
        e.setStatus(ExamType.Status.ACTIVE);
        return repo.save(e);
    }

    public void delete(String id) {
        ExamType e = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ExamType", id));
        long inUse = examRepository.countByExamType(e.getName());
        if (inUse > 0) {
            throw new BusinessException(
                    "This exam type is used by " + inUse + " exam(s). Archive it instead of deleting.");
        }
        repo.deleteById(id);
    }

    private int nextOrder() {
        return (int) (repo.count() + 1);
    }

    private void seedDefaults() {
        for (int i = 0; i < DEFAULTS.length; i++) {
            if (repo.existsByNameIgnoreCase(DEFAULTS[i])) continue;
            ExamType e = new ExamType();
            e.setId(UUID.randomUUID().toString());
            e.setName(DEFAULTS[i]);
            e.setDisplayOrder(i + 1);
            e.setStatus(ExamType.Status.ACTIVE);
            repo.save(e);
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}
