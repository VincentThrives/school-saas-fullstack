package com.saas.school.modules.student.controller;
import com.saas.school.common.response.ApiResponse;
import com.saas.school.common.response.PageResponse;
import com.saas.school.modules.student.dto.*;
import com.saas.school.modules.student.service.StudentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Students")
@RestController
@RequestMapping("/api/v1/students")
public class StudentController {
    @Autowired private StudentService studentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','TEACHER')")
    public ResponseEntity<ApiResponse<PageResponse<StudentDto>>> list(
            @RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,
            @RequestParam(required=false) String classId,
            @RequestParam(required=false) String sectionId,
            @RequestParam(required=false) String search) {
        return ResponseEntity.ok(ApiResponse.success(
            studentService.listStudents(page, size, classId, sectionId, search)));
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
}