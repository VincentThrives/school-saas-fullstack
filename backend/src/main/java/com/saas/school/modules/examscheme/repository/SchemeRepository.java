package com.saas.school.modules.examscheme.repository;

import com.saas.school.modules.examscheme.model.Scheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SchemeRepository extends MongoRepository<Scheme, String> {
    List<Scheme> findAllByOrderByDisplayOrderAscNameAsc();
    List<Scheme> findByStatusOrderByDisplayOrderAscNameAsc(Scheme.Status status);
    Optional<Scheme> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
}
