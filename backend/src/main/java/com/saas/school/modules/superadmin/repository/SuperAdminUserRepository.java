package com.saas.school.modules.superadmin.repository;

import com.saas.school.modules.superadmin.model.SuperAdminUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface SuperAdminUserRepository extends MongoRepository<SuperAdminUser, String> {
    Optional<SuperAdminUser> findByEmail(String email);
}
