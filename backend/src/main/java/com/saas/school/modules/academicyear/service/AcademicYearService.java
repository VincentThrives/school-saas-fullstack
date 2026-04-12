package com.saas.school.modules.academicyear.service;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*; 
@Service @RequiredArgsConstructor
public class AcademicYearService {
    private final AcademicYearRepository repo;

    public List<AcademicYear> listAll() { return repo.findAll(); }

    public AcademicYear create(AcademicYear req) {
        if (repo.existsByLabel(req.getLabel()))
            throw new BusinessException("Academic year already exists: " + req.getLabel());
        req.setAcademicYearId(UUID.randomUUID().toString());
        req.setStatus(AcademicYear.Status.ACTIVE);
        return repo.save(req);
    }

    public AcademicYear setCurrent(String id) {
        repo.findByIsCurrent(true).ifPresent(y -> { y.setCurrent(false); repo.save(y); });
        AcademicYear year = repo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("AcademicYear", id));
        year.setCurrent(true);
        return repo.save(year);
    }

    public AcademicYear archive(String id) {
        AcademicYear year = repo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("AcademicYear", id));
        if (year.isCurrent()) throw new BusinessException("Cannot archive the current academic year.");
        year.setStatus(AcademicYear.Status.ARCHIVED);
        return repo.save(year);
    }
}