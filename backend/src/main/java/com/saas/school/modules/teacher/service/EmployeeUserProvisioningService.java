package com.saas.school.modules.teacher.service;

import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Auto-provisions a login-enabled {@link User} account for a freshly
 * saved {@link Teacher} record.
 *
 * <p>Extracted from {@code TeacherController.autoCreateUserForEmployee}
 * so both the single-add controller endpoint AND the bulk-import service
 * share the same rules: login = employee id, password =
 * {@code firstName + "@" + birthYear}, role derived from
 * {@link Teacher#getEmployeeRole()}, email defaulted to
 * {@code employeeId@employee.school} when the employee has none.</p>
 *
 * <p>Never throws — logs and returns null on failure so the caller can
 * still finish saving the Teacher row (the account can always be
 * re-provisioned later from the admin UI).</p>
 */
@Service
public class EmployeeUserProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeUserProvisioningService.class);

    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    /**
     * Ensures a User exists for this employee. Returns the userId to
     * stamp onto {@link Teacher#setUserId}, or null when provisioning
     * failed (already logged).
     */
    public String provision(Teacher employee) {
        try {
            String loginId = employee.getEmployeeId();
            String firstName = employee.getFirstName() != null ? employee.getFirstName() : "Employee";
            int birthYear = employee.getDateOfBirth() != null ? employee.getDateOfBirth().getYear() : 2000;
            String password = firstName + "@" + birthYear;

            UserRole userRole = mapEmployeeRoleToUserRole(employee.getEmployeeRole());

            String email = employee.getEmail() != null && !employee.getEmail().isEmpty()
                    ? employee.getEmail() : loginId + "@employee.school";
            if (userRepository.existsByEmailAndDeletedAtIsNull(email)) {
                log.warn("User with email {} already exists, reusing", email);
                return userRepository.findByEmailAndDeletedAtIsNull(email)
                        .map(User::getUserId).orElse(null);
            }

            User user = new User();
            user.setUserId(UUID.randomUUID().toString());
            user.setTenantId(TenantContext.getTenantId());
            user.setEmail(email);
            user.setUsername(loginId);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setRole(userRole);
            user.setFirstName(employee.getFirstName());
            user.setLastName(employee.getLastName());
            user.setPhone(employee.getPhone());
            user.setActive(true);
            user.setLocked(false);
            user.setFailedLoginAttempts(0);
            user.setCreatedAt(Instant.now());

            userRepository.save(user);
            log.info("Auto-created User for employee: loginId={}, defaultPassword={}", loginId, password);
            return user.getUserId();
        } catch (Exception e) {
            log.error("Failed to auto-create User for employee {}: {}",
                employee.getEmployeeId(), e.getMessage());
            return null;
        }
    }

    /** PRINCIPAL and COORDINATOR get their dedicated roles; everyone
     *  else lands on TEACHER (the default login role for staff). */
    private UserRole mapEmployeeRoleToUserRole(String employeeRole) {
        if ("PRINCIPAL".equals(employeeRole)) return UserRole.PRINCIPAL;
        if ("COORDINATOR".equals(employeeRole)) return UserRole.SCHOOL_COORDINATOR;
        return UserRole.TEACHER;
    }
}
