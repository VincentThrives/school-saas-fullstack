package com.saas.school.modules.user.repository;

import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmailAndDeletedAtIsNull(String email);
    Optional<User> findByUsernameAndDeletedAtIsNull(String username);
    Optional<User> findByUserIdAndDeletedAtIsNull(String userId);
    Page<User> findByRoleAndDeletedAtIsNull(UserRole role, Pageable pageable);

    @Query("{ 'role': ?0, 'isActive': ?1, 'deletedAt': null }")
    Page<User> findByRoleAndIsActive(UserRole role, boolean active, Pageable pageable);

    @Query("{ '$or': [{'firstName': {$regex: ?0, $options: 'i'}}, {'lastName': {$regex: ?0, $options: 'i'}}, {'email': {$regex: ?0, $options: 'i'}}], 'deletedAt': null }")
    Page<User> searchByName(String query, Pageable pageable);

    Page<User> findByDeletedAtIsNull(Pageable pageable);

    boolean existsByEmailAndDeletedAtIsNull(String email);
    long countByRoleAndDeletedAtIsNull(UserRole role);
}
