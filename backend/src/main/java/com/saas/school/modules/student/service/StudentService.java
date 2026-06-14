package com.saas.school.modules.student.service;

import com.saas.school.common.audit.AuditService;
import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.common.response.PageResponse;
import com.saas.school.config.mongodb.TenantContext;
import com.saas.school.modules.academicyear.model.AcademicYear;
import com.saas.school.modules.academicyear.repository.AcademicYearRepository;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.attendance.model.StudentsAttendance;
import com.saas.school.modules.attendance.repository.StudentsAttendanceRepository;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.model.Subject;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.classes.repository.SubjectRepository;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.model.StudentAssessments;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.StudentAssessmentsRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.model.TeacherSubjectAssignment;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.teacher.repository.TeacherSubjectAssignmentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.model.UserRole;
import com.saas.school.modules.user.repository.UserRepository;
import com.saas.school.modules.user.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class StudentService {

    private static final Logger log = LoggerFactory.getLogger(StudentService.class);

    @Autowired private StudentRepository studentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private UserService userService;
    @Autowired private AcademicYearRepository academicYearRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuditService auditService;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private TeacherRepository teacherRepository;
    @Autowired private TeacherSubjectAssignmentRepository assignmentRepository;
    @Autowired private SchoolClassRepository schoolClassRepository;
    @Autowired private SubjectRepository subjectRepository;
    @Autowired private StudentsAttendanceRepository studentsAttendanceRepository;
    @Autowired private ExamRepository examRepository;
    @Autowired private ExamMarkRepository examMarkRepository;
    @Autowired private StudentAssessmentsRepository studentAssessmentsRepository;

    public PageResponse<StudentDto> listStudents(int page, int size,
                                                  String classId, String sectionId, String search) {
        return listStudents(page, size, null, classId, sectionId, search);
    }

    /**
     * Paginated list with composable filters — every filter is optional and
     * stacks as an AND. Replaces a chain of "if classId else if search else …"
     * that couldn't mix filters (e.g. "search inside this academic year") and
     * forced the frontend to fetch 500 rows then re-filter in JavaScript.
     *
     * <p>Search matches against firstName, lastName, parentName, admissionNumber
     * and rollNumber. Case-insensitive substring.
     */
    public PageResponse<StudentDto> listStudents(int page, int size,
                                                  String academicYearId,
                                                  String classId, String sectionId, String search) {
        Criteria criteria = Criteria.where("deletedAt").is(null);
        if (academicYearId != null && !academicYearId.isBlank()) {
            criteria.and("academicYearId").is(academicYearId);
        }
        if (classId != null && !classId.isBlank()) {
            criteria.and("classId").is(classId);
        }
        if (sectionId != null && !sectionId.isBlank()) {
            criteria.and("sectionId").is(sectionId);
        }
        if (search != null && !search.isBlank()) {
            // Tokenize on whitespace so multi-word queries like "Priya H" or
            // "Hegde Priya" match a student whose firstName + lastName
            // together satisfy every token — even though no SINGLE field
            // contains the whole phrase. The earlier implementation did one
            // OR across fields with the raw query, so anything past the
            // first space silently returned nothing because "Priya H" was
            // never a substring of firstName ("Priya") or lastName
            // ("Hegde") taken alone.
            //
            // Semantics now:
            //   - Each whitespace-delimited token must match SOME searchable
            //     field (firstName / lastName / parentName / admissionNumber
            //     / rollNumber) — case-insensitive substring.
            //   - AND across tokens, OR across fields per token.
            //   - Word order does not matter ("Hegde Priya" works too).
            //   - A trailing space (still typing) is ignored.
            String[] tokens = search.trim().split("\\s+");
            java.util.List<Criteria> tokenCriterias = new java.util.ArrayList<>(tokens.length);
            for (String token : tokens) {
                if (token.isEmpty()) continue;
                String regex = java.util.regex.Pattern.quote(token);
                tokenCriterias.add(new Criteria().orOperator(
                        Criteria.where("firstName").regex(regex, "i"),
                        Criteria.where("lastName").regex(regex, "i"),
                        Criteria.where("parentName").regex(regex, "i"),
                        Criteria.where("admissionNumber").regex(regex, "i"),
                        Criteria.where("rollNumber").regex(regex, "i")
                ));
            }
            if (!tokenCriterias.isEmpty()) {
                criteria.andOperator(tokenCriterias.toArray(new Criteria[0]));
            }
        }

        Query query = new Query(criteria).with(Sort.by("createdAt").descending());
        long total = mongoTemplate.count(query, Student.class);
        query.skip((long) page * size).limit(size);
        List<Student> students = mongoTemplate.find(query, Student.class);

        return PageResponse.of(students.stream().map(this::toDto).toList(),
                total, page, size);
    }

    /** Resolve the currently logged-in student's record by their user id. */
    public StudentDto getStudentByUserId(String userId) {
        Student s = studentRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", userId));
        return toDto(s);
    }

    /**
     * Date-by-date attendance for one subject for the student identified by
     * {@code userId}. Reads the StudentsAttendance batch collection for the
     * student's class+section, keeps only batches with the matching subject,
     * pulls this student's entry from each, and tallies totals.
     */
    public SubjectAttendanceDetail getMySubjectAttendanceDetail(String userId, String subjectId) {
        Student me = studentRepository.findByUserIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", userId));
        SubjectAttendanceDetail out = new SubjectAttendanceDetail();
        out.setSubjectId(subjectId);
        out.setSubjectName(subjectRepository.findById(subjectId)
                .map(s -> s.getName()).orElse(subjectId));

        List<com.saas.school.modules.attendance.model.StudentsAttendance> batches =
                studentsAttendanceRepository.findByClassIdAndSectionIdAndDateGreaterThanEqualAndDateLessThanEqual(
                        me.getClassId(), me.getSectionId(),
                        java.time.LocalDate.of(1970, 1, 1),
                        java.time.LocalDate.of(2999, 12, 31));

        for (var doc : batches) {
            if (doc.getEntries() == null) continue;
            if (subjectId == null || subjectId.isBlank()) continue;
            if (!subjectId.equals(doc.getSubjectId())) continue;

            var myEntry = doc.getEntries().stream()
                    .filter(e -> me.getStudentId().equals(e.getStudentId()))
                    .findFirst().orElse(null);
            if (myEntry == null) continue;

            String status = myEntry.getStatus() == null ? "" : myEntry.getStatus().toUpperCase();
            String dateStr = doc.getDate() == null ? "" : doc.getDate().toString();
            out.getEntries().add(new SubjectAttendanceDetail.DayEntry(
                    dateStr, doc.getPeriodNumber(), status, myEntry.getRemarks()));

            out.setTotal(out.getTotal() + 1);
            switch (status) {
                case "PRESENT":  out.setPresent(out.getPresent() + 1); break;
                case "ABSENT":   out.setAbsent(out.getAbsent() + 1);   break;
                case "LATE":     out.setLate(out.getLate() + 1);       break;
                case "HALF_DAY": out.setLate(out.getLate() + 1);       break;
                default: /* unknown — counted in total but not in any bucket */ break;
            }
        }

        // Newest first.
        out.getEntries().sort((a, b) -> {
            int byDate = b.getDate().compareTo(a.getDate());
            if (byDate != 0) return byDate;
            return Integer.compare(a.getPeriodNumber(), b.getPeriodNumber());
        });

        out.setPercentage(out.getTotal() == 0 ? 0
                : Math.round(((double) out.getPresent() / out.getTotal()) * 10000.0) / 100.0);
        return out;
    }

    public StudentDto getStudent(String studentId) {
        return toDto(findStudent(studentId));
    }

    public StudentDto createStudent(CreateStudentRequest req) {
        if (studentRepository.findByAdmissionNumberAndDeletedAtIsNull(req.getAdmissionNumber()).isPresent()) {
            throw new BusinessException("Admission number already exists: " + req.getAdmissionNumber());
        }

        Student student = new Student();
        student.setStudentId(UUID.randomUUID().toString());
        student.setUserId(req.getUserId());
        // Title-case names; lowercase email; digits-only phone; UPPERCASE
        // blood group. Same normalisation the bulk import uses so manual
        // entries and imports land in the DB with one consistent shape.
        student.setFirstName(StudentFieldNormalizer.titleCase(req.getFirstName()));
        student.setLastName(StudentFieldNormalizer.titleCase(req.getLastName()));
        student.setPhone(StudentFieldNormalizer.phoneDigits(req.getPhone()));
        student.setEmail(StudentFieldNormalizer.lower(req.getEmail()));
        student.setAdmissionNumber(StudentFieldNormalizer.trimToNull(req.getAdmissionNumber()));
        student.setRollNumber(StudentFieldNormalizer.trimToNull(req.getRollNumber()));
        student.setClassId(req.getClassId());
        student.setSectionId(req.getSectionId());
        student.setAcademicYearId(req.getAcademicYearId());
        student.setParentIds(req.getParentIds());
        student.setDateOfBirth(req.getDateOfBirth());
        student.setGender(req.getGender());
        student.setBloodGroup(StudentFieldNormalizer.upper(req.getBloodGroup()));
        student.setAddress(normaliseAddress(mapAddress(req.getAddress())));
        student.setParentName(StudentFieldNormalizer.titleCase(req.getParentName()));
        student.setParentPhone(StudentFieldNormalizer.phoneDigits(req.getParentPhone()));
        student.setParentEmail(StudentFieldNormalizer.lower(req.getParentEmail()));
        student.setSubjectIds(req.getSubjectIds());

        // Create first academic record
        Student.AcademicRecord record = new Student.AcademicRecord(
                req.getAcademicYearId(), req.getClassId(), req.getSectionId(),
                req.getSubjectIds(), true);
        List<Student.AcademicRecord> records = new ArrayList<>();
        records.add(record);
        student.setAcademicRecords(records);

        // Auto-create User account for login
        String generatedUserId = autoCreateUserForStudent(student, req);
        if (generatedUserId != null) {
            student.setUserId(generatedUserId);
        }

        studentRepository.save(student);
        auditService.log("CREATE_STUDENT", "Student", student.getStudentId(),
                "Student created: " + student.getAdmissionNumber());
        return toDto(student);
    }

    public StudentDto updateStudent(String studentId, UpdateStudentRequest req) {
        Student s = findStudent(studentId);
        // Snapshot the OLD values that gate the password-resync rule. We need
        // this BEFORE applying any changes so we can detect a real diff.
        String oldFirstName = s.getFirstName();
        java.time.LocalDate oldDob = s.getDateOfBirth();

        // Same normalisation as createStudent — Title-case names, digits-only
        // phone, lowercase email, UPPERCASE blood group.
        if (req.getFirstName()     != null) s.setFirstName(StudentFieldNormalizer.titleCase(req.getFirstName()));
        if (req.getLastName()      != null) s.setLastName(StudentFieldNormalizer.titleCase(req.getLastName()));
        if (req.getPhone()         != null) s.setPhone(StudentFieldNormalizer.phoneDigits(req.getPhone()));
        if (req.getEmail()         != null) s.setEmail(StudentFieldNormalizer.lower(req.getEmail()));
        if (req.getRollNumber()    != null) s.setRollNumber(StudentFieldNormalizer.trimToNull(req.getRollNumber()));
        if (req.getClassId()       != null) s.setClassId(req.getClassId());
        if (req.getSectionId()     != null) s.setSectionId(req.getSectionId());
        if (req.getGender()        != null) s.setGender(req.getGender());
        if (req.getDateOfBirth()   != null) s.setDateOfBirth(req.getDateOfBirth());
        if (req.getBloodGroup()    != null) s.setBloodGroup(StudentFieldNormalizer.upper(req.getBloodGroup()));
        if (req.getAddress()       != null) s.setAddress(normaliseAddress(mapAddress(req.getAddress())));
        if (req.getParentName()    != null) s.setParentName(StudentFieldNormalizer.titleCase(req.getParentName()));
        if (req.getParentPhone()   != null) s.setParentPhone(StudentFieldNormalizer.phoneDigits(req.getParentPhone()));
        if (req.getParentEmail()   != null) s.setParentEmail(StudentFieldNormalizer.lower(req.getParentEmail()));
        if (req.getSubjectIds()    != null) s.setSubjectIds(req.getSubjectIds());

        // Sync active academic record with updated top-level fields
        Student.AcademicRecord active = s.getActiveRecord();
        if (active != null) {
            active.setClassId(s.getClassId());
            active.setSectionId(s.getSectionId());
            active.setSubjectIds(s.getSubjectIds());
        }

        studentRepository.save(s);

        // If firstName or DOB actually changed, regenerate the linked User's
        // default password (firstName + "@" + birthYear) so the credentials
        // stay in lockstep with the profile values the admin sees.
        boolean firstNameChanged = !java.util.Objects.equals(oldFirstName, s.getFirstName());
        boolean dobChanged = !java.util.Objects.equals(oldDob, s.getDateOfBirth());
        if (s.getUserId() != null && (firstNameChanged || dobChanged)) {
            userService.resyncDefaultPassword(s.getUserId(), s.getFirstName(),
                    s.getLastName(), s.getDateOfBirth());
        }

        auditService.log("UPDATE_STUDENT", "Student", studentId, "Student updated");
        return toDto(s);
    }

    public void deleteStudent(String studentId) {
        Student s = findStudent(studentId);
        s.setDeletedAt(Instant.now());
        studentRepository.save(s);
        auditService.log("DELETE_STUDENT", "Student", studentId, "Student soft deleted");
    }

    /**
     * Self-service update for the logged-in student. Only fields on
     * {@link StudentSelfUpdateRequest} are honored — firstName, DOB, class
     * etc. cannot be changed via this path even if the client sends them
     * (the DTO simply doesn't expose those fields).
     *
     * No password resync hook is needed here: by construction this endpoint
     * cannot change the firstName/DOB inputs that drive the auto-password.
     */
    public StudentDto updateMyProfile(String userId, StudentSelfUpdateRequest req) {
        StudentDto me = getStudentByUserId(userId);
        Student s = findStudent(me.getStudentId());
        if (req.getPhone()       != null) s.setPhone(req.getPhone());
        if (req.getEmail()       != null) s.setEmail(req.getEmail());
        if (req.getBloodGroup()  != null) s.setBloodGroup(req.getBloodGroup());
        if (req.getAddress()     != null) s.setAddress(mapAddress(req.getAddress()));
        if (req.getParentName()  != null) s.setParentName(req.getParentName());
        if (req.getParentPhone() != null) s.setParentPhone(req.getParentPhone());
        if (req.getParentEmail() != null) s.setParentEmail(req.getParentEmail());
        studentRepository.save(s);
        auditService.log("PROFILE_SELF_UPDATE", "Student", s.getStudentId(),
                "Student updated own profile");
        return toDto(s);
    }

    /** Year-end bulk promotion: move all students in classId/sectionId to nextClassId/nextSectionId */
    public BulkPromoteResult bulkPromote(BulkPromoteRequest req) {
        // Validate: FROM academic year must have ended
        var students = studentRepository.findByClassIdAndSectionIdAndDeletedAtIsNull(
                req.getFromClassId(), req.getFromSectionId());
        if (!students.isEmpty()) {
            String fromAcademicYearId = students.get(0).getAcademicYearId();
            if (fromAcademicYearId != null) {
                academicYearRepository.findById(fromAcademicYearId).ifPresent(ay -> {
                    if (ay.getEndDate() != null && ay.getEndDate().isAfter(java.time.LocalDate.now())) {
                        throw new BusinessException("Academic year \"" + ay.getLabel()
                                + "\" has not completed yet (ends on " + ay.getEndDate()
                                + "). Promotion is allowed only after the academic year ends.");
                    }
                });
            }
        }
        int promoted = 0, skipped = 0;

        for (Student s : students) {
            if (req.getExcludedStudentIds() != null
                    && req.getExcludedStudentIds().contains(s.getStudentId())) {
                skipped++;
                continue;
            }

            // Deactivate current active record (preserve history)
            if (s.getAcademicRecords() != null) {
                s.getAcademicRecords().forEach(r -> r.setActive(false));
            } else {
                // Migrate legacy student: create a record from current flat fields
                List<Student.AcademicRecord> records = new ArrayList<>();
                records.add(new Student.AcademicRecord(
                        s.getAcademicYearId(), s.getClassId(), s.getSectionId(),
                        s.getSubjectIds(), false));
                s.setAcademicRecords(records);
            }

            // Add new active record for the promoted class
            Student.AcademicRecord newRecord = new Student.AcademicRecord(
                    req.getToAcademicYearId(), req.getToClassId(), req.getToSectionId(),
                    null, true);
            s.getAcademicRecords().add(newRecord);

            // Sync top-level fields from new active record
            s.setClassId(req.getToClassId());
            s.setSectionId(req.getToSectionId());
            s.setAcademicYearId(req.getToAcademicYearId());
            s.setSubjectIds(null); // subjects for new class to be assigned later

            studentRepository.save(s);
            promoted++;
        }

        auditService.log("BULK_PROMOTE", "Student", "bulk",
                "Promoted " + promoted + " students to class " + req.getToClassId());
        return new BulkPromoteResult(promoted, skipped);
    }

    // ── Bulk import (Excel) ─────────────────────────────────────────

    /**
     * Insert many students at once, fast. Used by the Excel import path
     * where the regular per-row createStudent() would be unacceptable —
     * each call does ~6 DB round-trips plus a 100ms BCrypt hash, so 1800
     * rows would take 3-5 minutes and time the dialog out.
     *
     * <p>What this does differently:
     * <ol>
     *   <li><b>One uniqueness scan</b> — batch-load existing admission
     *       numbers in a single query; the importer pre-checked for dupes
     *       in the file, so we only need to confirm none collide with the
     *       DB right now.</li>
     *   <li><b>Parallel BCrypt</b> — each row needs a hashed password for
     *       the auto-created User account; parallelStream spreads that
     *       CPU work across cores.</li>
     *   <li><b>Two bulk writes</b> — one saveAll for Users, one saveAll
     *       for Students. Replaces ~10,800 single inserts (for 1800 rows)
     *       with two batched operations.</li>
     *   <li><b>One audit log entry</b> — covers the whole import. Per-row
     *       audit would otherwise dominate the response time.</li>
     * </ol>
     *
     * <p>Returns the list of created student ids in input order.
     */
    public List<String> bulkInsertFromImport(List<CreateStudentRequest> reqs) {
        if (reqs == null || reqs.isEmpty()) return List.of();

        // Final-mile uniqueness guard. The importer already de-duped
        // within-file; this catches the case where another admin created
        // a student with one of these admission numbers between the
        // validation pass and now.
        List<String> admissionNumbers = reqs.stream()
                .map(CreateStudentRequest::getAdmissionNumber)
                .filter(Objects::nonNull)
                .toList();
        List<Student> conflicting = studentRepository
                .findByAdmissionNumberInAndDeletedAtIsNull(admissionNumbers);
        if (!conflicting.isEmpty()) {
            String first = conflicting.get(0).getAdmissionNumber();
            throw new BusinessException(
                    "Admission number already exists: " + first
                    + " (and " + (conflicting.size() - 1) + " more). "
                    + "Re-download the template to refresh, then re-upload.");
        }

        String tenantId = TenantContext.getTenantId();
        Instant now = Instant.now();

        // ── Pre-generate unique student usernames ────────────────────
        // Scheme: username = parent's mobile number (digits only).
        //   First child of a family → "9876543210"
        //   2nd, 3rd siblings (same phone) → "9876543210varun", "9876543210pari"
        //
        // Sibling case appends the lowercased first name so the parent can
        // always derive the username from "my phone + my child's first name"
        // without looking it up. No separator — keeps usernames short and
        // easy to type on a mobile. If even that collides (twin with same
        // name AND same parent phone — vanishingly rare), append a numeric
        // tail to keep things saving rather than throw mid-batch.
        //
        // Must be SEQUENTIAL so siblings inside this batch see each other.
        // BCrypt still parallelises below; only this cheap math is serial.
        // We prime the "taken" set with every existing username in the
        // tenant so a teacher whose username happens to be "9876543210"
        // doesn't collide with an incoming student.
        Set<String> taken = new HashSet<>();
        for (User u : userRepository.findAllByDeletedAtIsNull()) {
            if (u != null && u.getUsername() != null) {
                taken.add(u.getUsername().toLowerCase(Locale.ROOT));
            }
        }
        List<String> assignedUsernames = new ArrayList<>(reqs.size());
        for (CreateStudentRequest req : reqs) {
            String phoneDigits = StudentFieldNormalizer.phoneDigits(req.getParentPhone());
            if (phoneDigits == null || phoneDigits.length() < 10) {
                // Required-field validator already runs upstream — this branch
                // only fires on malformed-but-present rows that somehow slip
                // through. Fall back to a unique placeholder so the import
                // still succeeds; admin can correct the phone later.
                phoneDigits = "no-phone-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            }
            String pick = phoneDigits;
            if (taken.contains(pick)) {
                // Sibling path — append the lowercased first name. No
                // separator: "9876543210pari" reads as cleanly as the bare
                // phone and stays short enough to type on a mobile.
                String firstSlug = StudentFieldNormalizer.usernameSlug(req.getFirstName());
                if (firstSlug == null) firstSlug = "child";
                pick = phoneDigits + firstSlug;
                // Twin-with-same-name fallback — append numeric tail.
                int n = 2;
                while (taken.contains(pick)) {
                    pick = phoneDigits + firstSlug + n;
                    n++;
                }
            }
            taken.add(pick);
            assignedUsernames.add(pick);
        }

        // Build User + Student docs in parallel — BCrypt is the most
        // expensive single step per row, so parallelStream spreads that
        // across CPU cores. Each tuple stays in (req-order) by zipping
        // results back to a list at the end.
        List<UserStudentPair> pairs = java.util.stream.IntStream.range(0, reqs.size())
                .parallel()
                .mapToObj(i -> buildPair(reqs.get(i), tenantId, now, assignedUsernames.get(i)))
                .toList();

        List<User> users = new ArrayList<>(pairs.size());
        List<Student> students = new ArrayList<>(pairs.size());
        for (UserStudentPair p : pairs) {
            users.add(p.user);
            students.add(p.student);
        }

        // Two bulk writes — Mongo treats saveAll as an ordered batch
        // operation, which is dramatically faster than N single saves.
        userRepository.saveAll(users);
        studentRepository.saveAll(students);

        auditService.log("BULK_IMPORT_STUDENTS", "Student", String.valueOf(students.size()),
                "Imported " + students.size() + " students via Excel upload");

        return students.stream().map(Student::getStudentId).toList();
    }

    /** Pair carrier so the parallel stream returns both halves at once. */
    private static final class UserStudentPair {
        final User user;
        final Student student;
        UserStudentPair(User user, Student student) { this.user = user; this.student = student; }
    }

    /** Build one (User, Student) pair from a request. No DB I/O.
     *
     *  @param assignedUsername the pre-generated unique slug to use as
     *                          the student's login id. Caller computes
     *                          these sequentially so in-batch suffixing
     *                          ("varun2", "varun3") stays deterministic
     *                          even though this method runs in parallel. */
    private UserStudentPair buildPair(CreateStudentRequest req, String tenantId, Instant now,
                                      String assignedUsername) {
        String studentId = UUID.randomUUID().toString();
        String firstName = StudentFieldNormalizer.titleCase(req.getFirstName());
        String lastName  = StudentFieldNormalizer.titleCase(req.getLastName());

        // Student login scheme — username = lowercase first-name slug
        // (passed in pre-deduped), password = DOB as DDMMYYYY. Falls back
        // to a safe placeholder if DOB is somehow missing so a row with
        // a half-broken date still ends up with a working account the
        // admin can later patch.
        String loginUsername = assignedUsername;
        String defaultPassword = StudentFieldNormalizer.dobAsPassword(req.getDateOfBirth());
        if (defaultPassword == null) defaultPassword = "00000000";

        String emailRaw = req.getEmail() != null && !req.getEmail().isEmpty()
                ? req.getEmail() : loginUsername + "@student.school";
        String userEmail = StudentFieldNormalizer.lower(emailRaw);

        User user = new User();
        user.setUserId(UUID.randomUUID().toString());
        user.setTenantId(tenantId);
        user.setEmail(userEmail);
        user.setUsername(loginUsername);
        user.setPasswordHash(passwordEncoder.encode(defaultPassword));   // <-- the slow bit, parallelised
        user.setRole(UserRole.STUDENT);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPhone(StudentFieldNormalizer.phoneDigits(req.getPhone()));
        user.setActive(true);
        user.setLocked(false);
        user.setFailedLoginAttempts(0);
        user.setCreatedAt(now);

        Student student = new Student();
        student.setStudentId(studentId);
        student.setUserId(user.getUserId());
        student.setFirstName(firstName);
        student.setLastName(lastName);
        student.setPhone(StudentFieldNormalizer.phoneDigits(req.getPhone()));
        student.setEmail(StudentFieldNormalizer.lower(req.getEmail()));
        student.setAdmissionNumber(StudentFieldNormalizer.trimToNull(req.getAdmissionNumber()));
        student.setRollNumber(StudentFieldNormalizer.trimToNull(req.getRollNumber()));
        student.setClassId(req.getClassId());
        student.setSectionId(req.getSectionId());
        student.setAcademicYearId(req.getAcademicYearId());
        student.setParentIds(req.getParentIds());
        student.setDateOfBirth(req.getDateOfBirth());
        student.setGender(req.getGender());
        student.setBloodGroup(StudentFieldNormalizer.upper(req.getBloodGroup()));
        student.setAddress(normaliseAddress(mapAddress(req.getAddress())));
        student.setParentName(StudentFieldNormalizer.titleCase(req.getParentName()));
        student.setParentPhone(StudentFieldNormalizer.phoneDigits(req.getParentPhone()));
        student.setParentEmail(StudentFieldNormalizer.lower(req.getParentEmail()));
        student.setSubjectIds(req.getSubjectIds());

        Student.AcademicRecord record = new Student.AcademicRecord(
                req.getAcademicYearId(), req.getClassId(), req.getSectionId(),
                req.getSubjectIds(), true);
        List<Student.AcademicRecord> records = new ArrayList<>(1);
        records.add(record);
        student.setAcademicRecords(records);

        return new UserStudentPair(user, student);
    }

    // ── Auto User Creation ─────────────────────────────────────────

    private String autoCreateUserForStudent(Student student, CreateStudentRequest req) {
        try {
            // ── Username scheme — parent's phone digits.
            //   First child of a family → "9876543210"
            //   Sibling (phone already taken) → "9876543210varun"
            //   Twin same name (rare) → "9876543210varun2", "varun3" …
            // No separator between phone and name — keeps the username short
            // enough to comfortably type on a mobile keypad. The phone column
            // is @NotBlank on the DTO, so a null here is a legit programmer
            // error — we fall back to a UUID-tail slug so the account still
            // saves and the admin can fix the phone later.
            String phoneDigits = StudentFieldNormalizer.phoneDigits(req.getParentPhone());
            if (phoneDigits == null || phoneDigits.length() < 10) {
                phoneDigits = "no-phone-" + java.util.UUID.randomUUID().toString().substring(0, 6);
            }
            String loginUsername = phoneDigits;
            if (userRepository.existsByUsernameAndDeletedAtIsNull(loginUsername)) {
                String firstSlug = StudentFieldNormalizer.usernameSlug(req.getFirstName());
                if (firstSlug == null) firstSlug = "child";
                loginUsername = phoneDigits + firstSlug;
                int n = 2;
                while (userRepository.existsByUsernameAndDeletedAtIsNull(loginUsername)) {
                    loginUsername = phoneDigits + firstSlug + n;
                    n++;
                }
            }

            // ── Password = DOB as DDMMYYYY. Falls back to a safe placeholder
            // if DOB wasn't provided so the account stays usable for an admin
            // to log in and fix the record.
            String password = StudentFieldNormalizer.dobAsPassword(req.getDateOfBirth());
            if (password == null) password = "00000000";

            // Email defaults to <username>@student.school so we always have a
            // unique recovery channel even when the admin didn't enter one.
            // The username-existence loop above guarantees this is unique too.
            String email = req.getEmail() != null && !req.getEmail().isEmpty()
                    ? StudentFieldNormalizer.lower(req.getEmail())
                    : loginUsername + "@student.school";
            if (userRepository.existsByEmailAndDeletedAtIsNull(email)) {
                log.warn("User with email {} already exists, linking student to it", email);
                return userRepository.findByEmailAndDeletedAtIsNull(email)
                        .map(User::getUserId).orElse(null);
            }

            User user = new User();
            user.setUserId(UUID.randomUUID().toString());
            user.setTenantId(TenantContext.getTenantId());
            user.setEmail(email);
            user.setUsername(loginUsername);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setRole(UserRole.STUDENT);
            user.setFirstName(StudentFieldNormalizer.titleCase(req.getFirstName()));
            user.setLastName(StudentFieldNormalizer.titleCase(req.getLastName()));
            user.setPhone(StudentFieldNormalizer.phoneDigits(req.getPhone()));
            user.setActive(true);
            user.setLocked(false);
            user.setFailedLoginAttempts(0);
            user.setCreatedAt(Instant.now());

            userRepository.save(user);
            log.info("Auto-created Student User: username={}, password={}", loginUsername, password);
            return user.getUserId();
        } catch (Exception e) {
            log.error("Failed to auto-create User for student: {}", e.getMessage());
            return null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Student findStudent(String studentId) {
        return studentRepository.findById(studentId)
                .filter(s -> s.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
    }

    private Student.Address mapAddress(CreateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        Student.Address address = new Student.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setZip(dto.getZip());
        return address;
    }

    private Student.Address mapAddress(UpdateStudentRequest.AddressDto dto) {
        if (dto == null) return null;
        Student.Address address = new Student.Address();
        address.setStreet(dto.getStreet());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setZip(dto.getZip());
        return address;
    }

    /**
     * Apply Title Case + digit-only normalisation to an Address. Returns null
     * when the input is null, and silently drops the address altogether when
     * every field ends up blank (so a row that only set city wins doesn't
     * persist as an {street: null, city: "X", state: null, zip: null}).
     */
    Student.Address normaliseAddress(Student.Address address) {
        if (address == null) return null;
        String street = StudentFieldNormalizer.titleCase(address.getStreet());
        String city = StudentFieldNormalizer.titleCase(address.getCity());
        String state = StudentFieldNormalizer.titleCase(address.getState());
        String zip = StudentFieldNormalizer.trimToNull(address.getZip());
        if (street == null && city == null && state == null && zip == null) return null;
        Student.Address out = new Student.Address();
        out.setStreet(street);
        out.setCity(city);
        out.setState(state);
        out.setZip(zip);
        return out;
    }

    public StudentDto toDto(Student s) {
        StudentDto dto = new StudentDto();
        dto.setStudentId(s.getStudentId());
        dto.setUserId(s.getUserId());
        dto.setFirstName(s.getFirstName());
        dto.setLastName(s.getLastName());
        dto.setPhone(s.getPhone());
        dto.setEmail(s.getEmail());
        dto.setAdmissionNumber(s.getAdmissionNumber());
        dto.setRollNumber(s.getRollNumber());
        dto.setClassId(s.getClassId());
        dto.setSectionId(s.getSectionId());
        dto.setAcademicYearId(s.getAcademicYearId());
        dto.setParentIds(s.getParentIds());
        dto.setDateOfBirth(s.getDateOfBirth());
        dto.setGender(s.getGender());
        dto.setBloodGroup(s.getBloodGroup());
        dto.setParentName(s.getParentName());
        dto.setParentPhone(s.getParentPhone());
        dto.setParentEmail(s.getParentEmail());
        dto.setSubjectIds(s.getSubjectIds());
        dto.setAddress(s.getAddress());
        dto.setAcademicRecords(s.getAcademicRecords());
        dto.setCreatedAt(s.getCreatedAt());
        return dto;
    }

    // ── My Students (teacher view) ───────────────────────────────────

    /**
     * Returns the students for every section where the current teacher is
     * the CLASS_TEACHER. One HTTP call, fully resolved server-side.
     * If the caller has no teacher profile, or no CLASS_TEACHER assignment,
     * the response flags {@code classTeacher=false} with a human-readable
     * reason and an empty classes list.
     */
    public MyClassStudentsResponse getMyClassStudents(String userId) {
        MyClassStudentsResponse res = new MyClassStudentsResponse();

        if (userId == null) {
            res.setClassTeacher(false);
            res.setReason("NO_PROFILE");
            return res;
        }
        Teacher teacher = teacherRepository.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        if (teacher == null) {
            res.setClassTeacher(false);
            res.setReason("NO_PROFILE");
            return res;
        }

        // Pull all assignments for the teacher — the canonical source — and
        // keep only the rows where they are the CLASS_TEACHER.
        List<TeacherSubjectAssignment> mine = assignmentRepository.findByTeacherId(teacher.getTeacherId());
        List<TeacherSubjectAssignment> classTeacherRows = new ArrayList<>();
        for (TeacherSubjectAssignment a : mine) {
            if (a.getStatus() == TeacherSubjectAssignment.Status.ARCHIVED) continue;
            if (a.getRoles() == null) continue;
            if (!a.getRoles().contains(TeacherSubjectAssignment.Role.CLASS_TEACHER)) continue;
            if (a.getClassId() == null || a.getSectionId() == null) continue;
            classTeacherRows.add(a);
        }

        // Legacy fallback — SchoolClass.sections[].classTeacherId
        if (classTeacherRows.isEmpty()) {
            for (SchoolClass cls : schoolClassRepository.findAll()) {
                if (cls.getSections() == null) continue;
                for (SchoolClass.Section sec : cls.getSections()) {
                    String ct = sec.getClassTeacherId();
                    if (ct == null) continue;
                    if (ct.equals(teacher.getTeacherId()) || ct.equals(teacher.getUserId())) {
                        TeacherSubjectAssignment shim = new TeacherSubjectAssignment();
                        shim.setClassId(cls.getClassId());
                        shim.setSectionId(sec.getSectionId());
                        shim.setAcademicYearId(cls.getAcademicYearId());
                        classTeacherRows.add(shim);
                    }
                }
            }
        }

        if (classTeacherRows.isEmpty()) {
            res.setClassTeacher(false);
            res.setReason("NO_CLASS_TEACHER_ROLE");
            return res;
        }

        // For every class-teacher row, load students and snapshot class/section/AY names.
        for (TeacherSubjectAssignment a : classTeacherRows) {
            MyClassStudentsResponse.ClassStudents block = new MyClassStudentsResponse.ClassStudents();
            block.setClassId(a.getClassId());
            block.setSectionId(a.getSectionId());
            block.setAcademicYearId(a.getAcademicYearId());

            SchoolClass cls = schoolClassRepository.findById(a.getClassId()).orElse(null);
            if (cls != null) {
                block.setClassName(cls.getName());
                if (cls.getSections() != null) {
                    cls.getSections().stream()
                            .filter(s -> a.getSectionId().equals(s.getSectionId()))
                            .findFirst()
                            .ifPresent(s -> block.setSectionName(s.getName()));
                }
            }
            if (a.getAcademicYearId() != null) {
                academicYearRepository.findById(a.getAcademicYearId())
                        .ifPresent(ay -> block.setAcademicYearLabel(ay.getLabel()));
            }

            List<Student> students = studentRepository
                    .findByClassIdAndSectionIdAndDeletedAtIsNull(a.getClassId(), a.getSectionId());
            block.setStudents(students.stream().map(this::toDto).toList());
            res.getClasses().add(block);
        }

        res.setClassTeacher(true);
        return res;
    }

    // ── Student profile summary (attendance + exams for a year) ──────

    /**
     * Aggregates per-student attendance (overall + per-subject) and exam
     * marks for a given academic year. One HTTP call, one response — used
     * by the teacher's "My Students → click student" detail page.
     */
    public StudentProfileSummary getStudentProfileSummary(String studentId, String academicYearId) {
        StudentProfileSummary out = new StudentProfileSummary();

        Student student = studentRepository.findByStudentIdAndDeletedAtIsNull(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));

        // Resolve the academic year (fallback to current if not supplied or invalid).
        String yearId = (academicYearId == null || academicYearId.isBlank())
                ? student.getAcademicYearId() : academicYearId;
        AcademicYear ay = null;
        if (yearId != null) ay = academicYearRepository.findById(yearId).orElse(null);
        if (ay == null) {
            ay = academicYearRepository.findByIsCurrent(true).orElse(null);
            if (ay != null) yearId = ay.getAcademicYearId();
        }

        // ── Student snapshot ────────────────────────────────────────
        StudentProfileSummary.StudentInfo info = out.getStudent();
        info.setStudentId(student.getStudentId());
        info.setName(buildFullName(student));
        info.setAdmissionNumber(student.getAdmissionNumber());
        info.setRollNumber(student.getRollNumber());
        info.setGender(student.getGender() == null ? null : student.getGender().name());
        info.setDateOfBirth(student.getDateOfBirth() == null ? null : student.getDateOfBirth().toString());
        info.setClassId(student.getClassId());
        info.setSectionId(student.getSectionId());
        info.setAcademicYearId(yearId);
        info.setAcademicYearLabel(ay == null ? null : ay.getLabel());
        info.setParentName(student.getParentName());
        info.setParentPhone(student.getParentPhone());

        if (student.getClassId() != null) {
            SchoolClass cls = schoolClassRepository.findById(student.getClassId()).orElse(null);
            if (cls != null) {
                info.setClassName(cls.getName());
                if (student.getSectionId() != null && cls.getSections() != null) {
                    cls.getSections().stream()
                            .filter(s -> student.getSectionId().equals(s.getSectionId()))
                            .findFirst()
                            .ifPresent(s -> info.setSectionName(s.getName()));
                }
            }
        }

        // ── Attendance (scan StudentsAttendance batch docs for the year's window) ──
        java.time.LocalDate from = ay != null ? ay.getStartDate() : null;
        java.time.LocalDate to = ay != null ? ay.getEndDate() : null;
        if (from != null && to != null && student.getClassId() != null && student.getSectionId() != null) {
            List<StudentsAttendance> batches = studentsAttendanceRepository
                    .findByClassIdAndSectionIdAndDateGreaterThanEqualAndDateLessThanEqual(student.getClassId(), student.getSectionId(), from, to);
            aggregateAttendance(batches, studentId, out.getAttendance());
        }

        // ── Exam marks for the year ────────────────────────────────
        if (yearId != null && student.getClassId() != null) {
            List<Exam> exams = examRepository.findByClassIdAndAcademicYearId(student.getClassId(), yearId);
            if (!exams.isEmpty()) {
                out.setExams(buildExamRows(exams, studentId));
            }
        }

        return out;
    }

    private String buildFullName(Student s) {
        String first = s.getFirstName() == null ? "" : s.getFirstName();
        String last = s.getLastName() == null ? "" : s.getLastName();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? (s.getAdmissionNumber() == null ? "Student" : s.getAdmissionNumber()) : full;
    }

    /** Walk every batch doc, pluck this student's entry, tally overall + per-subject. */
    private void aggregateAttendance(List<StudentsAttendance> batches, String studentId,
                                      StudentProfileSummary.AttendanceSummary out) {
        StudentProfileSummary.AttendanceCounts overall = out.getOverall();
        java.util.Map<String, StudentProfileSummary.SubjectAttendance> bySubject = new java.util.HashMap<>();
        java.util.Set<String> subjectIds = new java.util.HashSet<>();
        // For schools that mark per-period instead of whole-day, derive overall
        // from a per-date roll-up: a day is PRESENT if any period was PRESENT,
        // else LATE if any was LATE, else HALF_DAY if any, else ABSENT.
        java.util.Map<String, String> periodDayStatus = new java.util.HashMap<>();

        for (StudentsAttendance doc : batches) {
            if (doc.getEntries() == null) continue;
            StudentsAttendance.StudentEntry myEntry = doc.getEntries().stream()
                    .filter(e -> studentId.equals(e.getStudentId()))
                    .findFirst().orElse(null);
            if (myEntry == null) continue;
            String status = myEntry.getStatus() == null ? "" : myEntry.getStatus().toUpperCase();

            boolean dayWise = doc.getPeriodNumber() == 0;

            if (dayWise) {
                overall.setTotal(overall.getTotal() + 1);
                bumpStatus(overall, status);
            } else {
                String subjectId = doc.getSubjectId();
                if (subjectId == null) continue;
                subjectIds.add(subjectId);
                StudentProfileSummary.SubjectAttendance sa = bySubject.computeIfAbsent(subjectId, id -> {
                    StudentProfileSummary.SubjectAttendance s = new StudentProfileSummary.SubjectAttendance();
                    s.setSubjectId(id);
                    return s;
                });
                sa.setTotal(sa.getTotal() + 1);
                switch (status) {
                    case "PRESENT":   sa.setPresent(sa.getPresent() + 1); break;
                    case "ABSENT":    sa.setAbsent(sa.getAbsent() + 1);   break;
                    case "LATE":      sa.setLate(sa.getLate() + 1);       break;
                    case "HALF_DAY":  sa.setLate(sa.getLate() + 1);       break; // fold half into late for subject
                    default: /* ignore */ break;
                }

                if (doc.getDate() != null) {
                    String dateKey = doc.getDate().toString();
                    periodDayStatus.merge(dateKey, status, this::mergeDayStatus);
                }
            }
        }

        // No whole-day records → derive overall by summing the per-subject
        // totals. This is honest: a student who was Absent in 1 of 5 periods
        // shouldn't show 100%. Earlier we did a day-best merge (PRESENT wins),
        // which hid every absence on a partially-attended day.
        if (overall.getTotal() == 0 && !bySubject.isEmpty()) {
            for (StudentProfileSummary.SubjectAttendance sa : bySubject.values()) {
                overall.setTotal(overall.getTotal() + sa.getTotal());
                overall.setPresent(overall.getPresent() + sa.getPresent());
                overall.setAbsent(overall.getAbsent() + sa.getAbsent());
                overall.setLate(overall.getLate() + sa.getLate());
            }
        }

        // Resolve subject names in bulk.
        if (!subjectIds.isEmpty()) {
            java.util.Map<String, String> nameById = new java.util.HashMap<>();
            for (Subject s : subjectRepository.findBySubjectIdIn(new java.util.ArrayList<>(subjectIds))) {
                nameById.put(s.getSubjectId(), s.getName());
            }
            for (StudentProfileSummary.SubjectAttendance sa : bySubject.values()) {
                sa.setSubjectName(nameById.getOrDefault(sa.getSubjectId(), sa.getSubjectId()));
                sa.setPercentage(sa.getTotal() == 0 ? 0
                        : Math.round(((double) sa.getPresent() / sa.getTotal()) * 10000.0) / 100.0);
            }
        }

        overall.setPercentage(overall.getTotal() == 0 ? 0
                : Math.round(((double) overall.getPresent() / overall.getTotal()) * 10000.0) / 100.0);

        List<StudentProfileSummary.SubjectAttendance> list = new java.util.ArrayList<>(bySubject.values());
        list.sort(java.util.Comparator.comparing(a ->
                a.getSubjectName() == null ? "" : a.getSubjectName().toLowerCase()));
        out.setBySubject(list);
    }

    /** Pick the "best" status for a day across multiple period entries.
     *  Priority: PRESENT > LATE > HALF_DAY > ABSENT. Anything unknown loses. */
    private String mergeDayStatus(String a, String b) {
        int pa = statusRank(a);
        int pb = statusRank(b);
        return pa >= pb ? a : b;
    }

    private int statusRank(String s) {
        if (s == null) return -1;
        switch (s) {
            case "PRESENT":  return 4;
            case "LATE":     return 3;
            case "HALF_DAY": return 2;
            case "ABSENT":   return 1;
            default:         return 0;
        }
    }

    private void bumpStatus(StudentProfileSummary.AttendanceCounts c, String status) {
        switch (status) {
            case "PRESENT":   c.setPresent(c.getPresent() + 1); break;
            case "ABSENT":    c.setAbsent(c.getAbsent() + 1);   break;
            case "LATE":      c.setLate(c.getLate() + 1);       break;
            case "HALF_DAY":  c.setHalfDay(c.getHalfDay() + 1); break;
            default: /* ignore */ break;
        }
    }

    /** Build one exam row per exam the student has a mark for. */
    private List<StudentProfileSummary.ExamMarkRow> buildExamRows(List<Exam> exams, String studentId) {
        // Prefer the batch collection; fall back to legacy per-mark docs.
        java.util.List<String> examIds = exams.stream().map(Exam::getExamId).toList();
        java.util.Map<String, Double> marksByExamId = new java.util.HashMap<>();
        java.util.Map<String, String> gradeByExamId = new java.util.HashMap<>();
        java.util.Map<String, Boolean> passedByExamId = new java.util.HashMap<>();

        for (StudentAssessments sa : studentAssessmentsRepository.findByExamIdIn(examIds)) {
            if (sa.getEntries() == null) continue;
            for (StudentAssessments.MarkEntry e : sa.getEntries()) {
                if (!studentId.equals(e.getStudentId())) continue;
                if (e.getMarksObtained() != null) marksByExamId.put(sa.getExamId(), e.getMarksObtained());
                if (e.getGrade() != null) gradeByExamId.put(sa.getExamId(), e.getGrade());
                passedByExamId.put(sa.getExamId(), e.isPassed());
                break;
            }
        }
        // Legacy fallback for exams where the batch doc is missing this student.
        for (ExamMark m : examMarkRepository.findByStudentIdAndExamIdIn(studentId, examIds)) {
            if (m.getMarksObtained() != null) marksByExamId.putIfAbsent(m.getExamId(), m.getMarksObtained());
            if (m.getGrade() != null) gradeByExamId.putIfAbsent(m.getExamId(), m.getGrade());
            passedByExamId.putIfAbsent(m.getExamId(), m.isPassed());
        }

        // Collect subject names in bulk.
        java.util.Set<String> subjectIdSet = new java.util.HashSet<>();
        for (Exam e : exams) if (e.getSubjectId() != null) subjectIdSet.add(e.getSubjectId());
        java.util.Map<String, String> subjectNameById = new java.util.HashMap<>();
        if (!subjectIdSet.isEmpty()) {
            for (Subject s : subjectRepository.findBySubjectIdIn(new java.util.ArrayList<>(subjectIdSet))) {
                subjectNameById.put(s.getSubjectId(), s.getName());
            }
        }

        List<StudentProfileSummary.ExamMarkRow> rows = new java.util.ArrayList<>();
        for (Exam exam : exams) {
            StudentProfileSummary.ExamMarkRow r = new StudentProfileSummary.ExamMarkRow();
            r.setExamId(exam.getExamId());
            r.setExamName(exam.getName());
            r.setExamType(exam.getExamType());
            r.setExamDate(exam.getExamDate() == null ? null : exam.getExamDate().toString());
            r.setSubjectId(exam.getSubjectId());
            r.setSubjectName(subjectNameById.getOrDefault(
                    exam.getSubjectId(),
                    exam.getSubjectName() != null ? exam.getSubjectName() : exam.getSubjectId()));
            r.setMaxMarks(exam.getMaxMarks());
            r.setPassingMarks(exam.getPassingMarks());
            r.setMarksObtained(marksByExamId.get(exam.getExamId()));
            r.setGrade(gradeByExamId.get(exam.getExamId()));
            r.setIsPassed(passedByExamId.get(exam.getExamId()));
            rows.add(r);
        }
        // Newest first.
        rows.sort(java.util.Comparator.comparing(
                (StudentProfileSummary.ExamMarkRow r) -> r.getExamDate() == null ? "" : r.getExamDate())
                .reversed());
        return rows;
    }
}
