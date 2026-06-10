package com.saas.school.modules.student.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.service.StudentImportService;
import com.saas.school.modules.student.service.StudentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Students")
@RestController
@RequestMapping("/api/v1/students")
public class StudentController {
    @Autowired private StudentService studentService;
    @Autowired private StudentImportService studentImportService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<PageResponse<StudentDto>>> list(
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,
            @RequestParam(required=false) String academicYearId,
            @RequestParam(required=false) String classId,
            @RequestParam(required=false) String sectionId,
            @RequestParam(required=false) String search) {
        return ResponseEntity.ok(ApiResponse.success(
            studentService.listStudents(page, size, academicYearId, classId, sectionId, search)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<StudentDto>> get(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(studentService.getStudent(id)));
    }

    /** Currently logged-in student's own record. Used by student-facing pages
     *  (timetable, dashboard) to scope themselves to the right class+section. */
    @GetMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentDto>> me(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(studentService.getStudentByUserId(userId)));
    }

    /** Self-service profile update for a STUDENT. Whitelisted to phone,
     *  email, address, blood group, and parent contact — identity fields
     *  (name, DOB, class, etc.) stay admin-controlled. */
    @PutMapping("/me/profile")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentDto>> updateMyProfile(
            @AuthenticationPrincipal String userId,
            @RequestBody StudentSelfUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
                studentService.updateMyProfile(userId, req), "Profile updated"));
    }

    /** Read-only attendance + exam summary for the logged-in student. */
    @GetMapping("/me/profile-summary")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentProfileSummary>> meProfileSummary(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String academicYearId) {
        StudentDto me = studentService.getStudentByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success(
                studentService.getStudentProfileSummary(me.getStudentId(), academicYearId)));
    }

    /** Date-by-date attendance for one subject for the logged-in student. */
    @GetMapping("/me/attendance/by-subject/{subjectId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubjectAttendanceDetail>> meSubjectAttendance(
            @AuthenticationPrincipal String userId,
            @PathVariable String subjectId) {
        return ResponseEntity.ok(ApiResponse.success(
                studentService.getMySubjectAttendanceDetail(userId, subjectId)));
    }

    /** One-call endpoint used by the teacher's "My Students" page. */
    @GetMapping("/my-class")
    @PreAuthorize("hasAnyRole('TEACHER','PRINCIPAL','SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<MyClassStudentsResponse>> myClassStudents(
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(ApiResponse.success(studentService.getMyClassStudents(userId)));
    }

    /** Per-student attendance + exam marks for a given academic year. */
    @GetMapping("/{id}/profile-summary")
    @PreAuthorize("hasAnyRole('TEACHER','PRINCIPAL','SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentProfileSummary>> profileSummary(
            @PathVariable String id,
            @RequestParam(required = false) String academicYearId) {
        return ResponseEntity.ok(ApiResponse.success(
                studentService.getStudentProfileSummary(id, academicYearId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentDto>> create(@Valid @RequestBody CreateStudentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(studentService.createStudent(req), "Student created"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentDto>> update(
            @PathVariable String id, @Valid @RequestBody UpdateStudentRequest req) {
        return ResponseEntity.ok(ApiResponse.success(studentService.updateStudent(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        studentService.deleteStudent(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Student deleted"));
    }

    @PostMapping("/bulk-promote")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<BulkPromoteResult>> bulkPromote(
            @Valid @RequestBody BulkPromoteRequest req) {
        return ResponseEntity.ok(ApiResponse.success(studentService.bulkPromote(req)));
    }

    // ── Bulk import (Excel) ──────────────────────────────────────────

    /**
     * Download the .xlsx import template — header row + sample row + an
     * instructions tab listing the configured classes/sections for the
     * picked academic year. Admin fills it, uploads back via /import.
     */
    @GetMapping("/import/template")
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ByteArrayResource> downloadImportTemplate(
            @RequestParam(required = false) String academicYearId) {
        byte[] bytes = studentImportService.buildTemplate(academicYearId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"students-import-template.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    /**
     * Upload a filled .xlsx and create the students it lists. All-or-nothing
     * — if any row fails validation, the response is a 400 with a row-by-row
     * error report and nothing is saved.
     */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SCHOOL_ADMIN')")
    public ResponseEntity<ApiResponse<StudentImportResult>> importStudents(
            @RequestPart("file") MultipartFile file,
            @RequestParam("academicYearId") String academicYearId) {
        StudentImportResult result = studentImportService.importFromExcel(file, academicYearId);
        return ResponseEntity.ok(ApiResponse.success(
                result, "Imported " + result.getCreated() + " students"));
    }
}